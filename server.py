#!/usr/bin/env python3
# server.py — DearName v2 로컬/배포 서버
# Claude API 프록시 + Gemini API 프록시 + 정적 파일 서빙
#
# 사용법:
#   pip install anthropic flask flask-cors google-generativeai
#   ANTHROPIC_API_KEY=sk-...  python server.py   # Claude 사용
#   GEMINI_API_KEY=AIza...    python server.py   # Gemini 사용 (무료 테스트)
#
# 배포: Render / Railway / Vercel(서버리스) 모두 지원
# 환경변수:
#   ANTHROPIC_API_KEY — Claude API (소견서 생성용)
#   GEMINI_API_KEY    — Google Gemini API (채팅 상담용, 무료 티어)
#   PORT              — 기본 3000

import os, json, re, sys
from pathlib import Path

# .env 파일 자동 로드 (로컬 개발용)
_env_path = Path(__file__).parent / '.env'
if _env_path.exists():
    for _line in _env_path.read_text(encoding='utf-8').splitlines():
        _line = _line.strip()
        if _line and not _line.startswith('#') and '=' in _line:
            _k, _v = _line.split('=', 1)
            os.environ.setdefault(_k.strip(), _v.strip())

try:
    from flask import Flask, request, jsonify, send_from_directory, send_file, Response
    from flask_cors import CORS
    import anthropic
except ImportError:
    print("필수 패키지 설치:")
    print("  pip install flask flask-cors anthropic google-generativeai")
    sys.exit(1)

sys.path.insert(0, str(Path(__file__).parent))
import lib.db as db  # 운영 데이터 적재 (admin_site_plan.md Phase 0) — 미설정 시 no-op

# Gemini는 선택적 임포트 (없어도 서버 동작)
try:
    from google import genai as google_genai
    _GENAI_OK = True
except ImportError:
    _GENAI_OK = False

# ── 설정 ─────────────────────────────────────────────────
BASE_DIR        = Path(__file__).parent
PORT            = int(os.environ.get('PORT', 3000))
API_KEY         = os.environ.get('ANTHROPIC_API_KEY', '')
GEMINI_API_KEY  = os.environ.get('GEMINI_API_KEY', '')
CLIENT          = anthropic.Anthropic(api_key=API_KEY) if API_KEY else None

# 어드민에서 값을 바꾸기 전까지 사용할 기본값 (admin_site_plan.md Phase 3 — 가격/점검모드)
# self: 셀프 작명 가격(현재 0=무료. 실제 과금은 아직 본 서비스에 연결돼 있지 않음 — 어드민에서
# 값만 관리 가능하고, 셀프 작명 결제 플로우 자체를 추가하려면 별도 작업 필요)
DEFAULT_PRICING = {
    'self': 0,
    'tiers': [
        {'count': 1, 'price': 30000},
        {'count': 2, 'price': 50000},
        {'count': 3, 'price': 70000},
        {'count': 5, 'price': 100000},
    ],
    # promotion: 전 상품 구성에 일괄 적용되는 기간 한정 %할인. enabled=false면 정가 그대로.
    'promotion': {'enabled': False, 'percent': 0, 'label': ''},
}
DEFAULT_MAINTENANCE = {'enabled': False, 'message': ''}

# lib/name-search-worker.js에 하드코딩돼 있던 금기 한자(뜻이 불길한 한자) 52자와 동일한 기본값.
# 어드민에서 목록을 바꾸기 전까지, 또는 DB 미설정 시 이 값으로 폴백한다.
DEFAULT_TABOO_HANJA = [
    '死', '鬼', '亡', '殺', '邪', '禍', '毒', '凶', '惡',
    '尸', '屍', '歿', '崩', '喪', '殉', '夭', '殞', '斃', '薨',
    '賤', '奴', '罪', '貧', '苦', '怨', '恨', '悲', '哭', '泣',
    '危', '破', '敗', '廢', '末', '窮', '孤', '暗',
    '盲', '啞', '癡', '狂', '愚', '劣', '醜', '陋', '拙',
    '辱', '侮', '欺', '奸', '賊', '盜',
]

# Gemini 클라이언트 초기화
if GEMINI_API_KEY and _GENAI_OK:
    _GEMINI_CLIENT = google_genai.Client(api_key=GEMINI_API_KEY)
else:
    _GEMINI_CLIENT = None

app = Flask(__name__, static_folder=str(BASE_DIR))
# *.vercel.app: 어드민(admin/)이 /api/hanja/* 같은 공개 읽기 API를 크로스오리진으로 호출하기 위함.
# 이 도메인들에 노출된 라우트는 전부 공개 조회(GET) 아니면 본 서비스 프론트가 어차피 같은 오리진에서
# 호출하는 것들이라, service_role/토스 시크릿 같은 민감정보는 절대 여기로 흘러들어오지 않는다.
CORS(app, origins=['http://localhost:*', 'https://*.dearname.kr', 'https://*.onrender.com', 'https://*.vercel.app'])

# ── 캐시 비활성화 헬퍼 ───────────────────────────────────
def _no_cache(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# ── 정적 파일 서빙 ────────────────────────────────────────
@app.route('/')
def index():
    return _no_cache(send_file(BASE_DIR / 'index.html'))

@app.route('/config.js')
def config_js():
    return _no_cache(send_file(BASE_DIR / 'config.js'))

@app.route('/data/<path:filename>')
def data_files(filename):
    return _no_cache(send_from_directory(BASE_DIR / 'data', filename))

@app.route('/lib/<path:filename>')
def lib_files(filename):
    # lib/ 폴더에는 브라우저용 JS 외에 서버 전용 db.py(Supabase 연동)도 함께 있으므로
    # .js 파일만 서빙해 소스 노출을 막는다.
    if not filename.endswith('.js'):
        return jsonify({'error': 'not found'}), 404
    return _no_cache(send_from_directory(BASE_DIR / 'lib', filename))

@app.route('/api/<path:filename>')
def api_files(filename):
    # api/claude-report.js 같은 정적 파일
    return _no_cache(send_from_directory(BASE_DIR / 'api', filename))

@app.route('/tests/<path:filename>')
def tests_files(filename):
    return _no_cache(send_from_directory(BASE_DIR / 'tests', filename))

# ── Claude API 프록시 ─────────────────────────────────────
@app.route('/proxy/claude', methods=['POST'])
def claude_proxy():
    """
    브라우저 → 이 서버 → Anthropic API
    CORS 문제 없이 Claude API 사용 가능
    """
    if not CLIENT:
        return jsonify({'error': 'ANTHROPIC_API_KEY 미설정'}), 500

    try:
        body = request.get_json(force=True)

        # 안전 검증: 허용된 모델만
        allowed_models = ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001']
        model = body.get('model', 'claude-sonnet-4-20250514')
        if model not in allowed_models:
            model = 'claude-sonnet-4-20250514'

        # max_tokens 제한 (비용 보호)
        max_tokens = min(body.get('max_tokens', 1000), 2000)

        response = CLIENT.messages.create(
            model      = model,
            max_tokens = max_tokens,
            system     = body.get('system', ''),
            messages   = body.get('messages', [])
        )

        db.insert_ai_usage('report', model, response.usage.input_tokens, response.usage.output_tokens)

        return jsonify({
            'content': [{'type': 'text', 'text': response.content[0].text}],
            'usage': {
                'input_tokens':  response.usage.input_tokens,
                'output_tokens': response.usage.output_tokens,
                'cache_read_input_tokens':     getattr(response.usage, 'cache_read_input_tokens', 0),
                'cache_creation_input_tokens': getattr(response.usage, 'cache_creation_input_tokens', 0),
            }
        })

    except anthropic.AuthenticationError:
        return jsonify({'error': 'API 키 인증 실패'}), 401
    except anthropic.RateLimitError:
        return jsonify({'error': '요청 한도 초과. 잠시 후 다시 시도해주세요.'}), 429
    except anthropic.APIError as e:
        return jsonify({'error': f'API 오류: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'서버 오류: {str(e)}'}), 500

# ── AI 작명 상담 채팅 ─────────────────────────────────────
def _build_chat_system_prompt(ctx):
    name       = ctx.get('nameKr', '')
    hanja      = ctx.get('nameHanja', '')
    score      = ctx.get('score', '')
    tagline    = ctx.get('tagline', '')
    saju       = ctx.get('saju', {})
    scores     = ctx.get('ohengScores', {})
    suri       = ctx.get('suri', {})
    hanja_list = ctx.get('hanja', [])
    stories    = ctx.get('stories', {})

    hanja_desc = '\n'.join([
        f"  - {h.get('char','')}({h.get('kr','')}): {h.get('meaning','')} / {h.get('oheng','')} 기운 / {h.get('strokes','')}획"
        for h in hanja_list
    ])

    suri_desc = '\n'.join([
        f"  - {v.get('name','')}({k}격 {v.get('num','')}수): {v.get('grade','')}"
        for k, v in suri.items()
    ])

    story_snippet = ''
    if stories.get('conclusion'):
        story_snippet = f"\n총평 요약: {str(stories['conclusion'])[:300]}"

    yr = saju.get('year', {});  mo = saju.get('month', {})
    dy = saju.get('day',  {});  ti = saju.get('time',  {})

    return f"""당신은 30년 경력의 최고 명리학 작명 전문가입니다.
현재 '{name}({hanja})' 이름의 AI 프리미엄 작명 보고서를 열람 중인 부모님과 채팅 상담을 진행합니다.

[분석된 이름 정보]
이름: {name} ({hanja}) — 종합 점수 {score}/100
핵심 메시지: {tagline}

사주 원국:
  연주 {yr.get('gan','')}{yr.get('ji','')} / 월주 {mo.get('gan','')}{mo.get('ji','')} / 일주 {dy.get('gan','')}{dy.get('ji','')} / 시주 {ti.get('gan','')}{ti.get('ji','')}

오행 점수: 木{scores.get('木',0):.1f} 火{scores.get('火',0):.1f} 土{scores.get('土',0):.1f} 金{scores.get('金',0):.1f} 水{scores.get('水',0):.1f}

한자 풀이:
{hanja_desc}

수리 4격:
{suri_desc}{story_snippet}

[답변 규칙]
- 채팅이므로 짧고 명확하게 (200자 내외, 길어도 350자 이내)
- 어려운 한자 용어는 반드시 () 안에 한글 풀이 병기
- 친근하고 따뜻한 톤, 부모님 입장에서 공감하며 답변
- 이 이름의 실제 데이터를 근거로 구체적으로 설명
- 모든 답변은 한국어로"""


@app.route('/proxy/claude-chat', methods=['POST'])
def claude_chat():
    if not CLIENT:
        return jsonify({'error': 'ANTHROPIC_API_KEY 미설정', 'reply': None}), 500

    try:
        body        = request.get_json(force=True)
        user_msg    = (body.get('message') or '').strip()
        context     = body.get('context') or {}
        history     = body.get('history') or []

        if not user_msg:
            return jsonify({'error': '질문이 비어 있습니다.', 'reply': None}), 400

        # 히스토리 최근 10턴만 허용 (비용 보호)
        history = history[-20:]

        system_prompt = _build_chat_system_prompt(context)
        messages = history + [{'role': 'user', 'content': user_msg}]

        response = CLIENT.messages.create(
            model      = 'claude-sonnet-4-6',
            max_tokens = 600,
            system     = system_prompt,
            messages   = messages
        )

        db.insert_ai_usage('chat', 'claude-sonnet-4-6', response.usage.input_tokens, response.usage.output_tokens)

        reply = response.content[0].text
        return jsonify({
            'reply': reply,
            'usage': response.usage.output_tokens
        })

    except anthropic.AuthenticationError:
        return jsonify({'error': 'API 키 인증 실패', 'reply': None}), 401
    except anthropic.RateLimitError:
        return jsonify({'error': '요청 한도 초과. 잠시 후 다시 시도해주세요.', 'reply': None}), 429
    except anthropic.APIError as e:
        return jsonify({'error': f'API 오류: {str(e)}', 'reply': None}), 500
    except Exception as e:
        return jsonify({'error': f'서버 오류: {str(e)}', 'reply': None}), 500


# ── Gemini 채팅 프록시 ────────────────────────────────────
@app.route('/proxy/gemini-chat', methods=['POST'])
def gemini_chat():
    """
    브라우저 → 이 서버 → Google Gemini API
    무료 티어: gemini-2.0-flash (15 req/분, 1M 토큰/일)
    발급: https://aistudio.google.com/apikey
    """
    if not _GEMINI_CLIENT:
        msg = 'google-genai 미설치 (pip install google-genai)' if not _GENAI_OK else 'GEMINI_API_KEY 미설정'
        return jsonify({'error': msg, 'reply': None}), 500

    try:
        body     = request.get_json(force=True)
        user_msg = (body.get('message') or '').strip()
        context  = body.get('context') or {}
        history  = body.get('history') or []

        if not user_msg:
            return jsonify({'error': '질문이 비어 있습니다.', 'reply': None}), 400

        # 시스템 프롬프트 (Claude 버전 재사용)
        system_prompt = _build_chat_system_prompt(context)

        # google-genai SDK 히스토리 형식
        # role: 'user' | 'model' (assistant → model 변환)
        from google.genai import types as genai_types
        gemini_history = []
        for turn in history[-20:]:
            role    = 'model' if turn.get('role') == 'assistant' else 'user'
            content = (turn.get('content') or '').strip()
            if content:
                gemini_history.append(
                    genai_types.Content(role=role, parts=[genai_types.Part(text=content)])
                )

        # 현재 사용자 메시지 추가
        gemini_history.append(
            genai_types.Content(role='user', parts=[genai_types.Part(text=user_msg)])
        )

        resp = _GEMINI_CLIENT.models.generate_content(
            model='gemini-2.0-flash',
            contents=gemini_history,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=600,
                temperature=0.7,
            )
        )

        usage_meta = getattr(resp, 'usage_metadata', None)
        in_tok  = getattr(usage_meta, 'prompt_token_count', 0) or 0
        out_tok = getattr(usage_meta, 'candidates_token_count', 0) or 0
        db.insert_ai_usage('chat', 'gemini-2.0-flash', in_tok, out_tok)

        reply = resp.text
        return jsonify({'reply': reply, 'usage': len(reply)})

    except Exception as e:
        err = str(e)
        if 'API_KEY' in err or 'credential' in err.lower() or '401' in err:
            return jsonify({'error': 'Gemini API 키 오류: ' + err, 'reply': None}), 401
        if 'quota' in err.lower() or 'rate' in err.lower() or '429' in err:
            return jsonify({'error': '요청 한도 초과. 잠시 후 다시 시도해주세요.', 'reply': None}), 429
        return jsonify({'error': f'Gemini 오류: {err}', 'reply': None}), 500


# ── 헬스체크 ─────────────────────────────────────────────
@app.route('/health')
def health():
    return jsonify({
        'status':     'ok',
        'claude':     'set' if API_KEY else 'missing',
        'gemini':     'set' if GEMINI_API_KEY else 'missing',
        'db':         'set' if db.ENABLED else 'missing',
        'version':    'v2.0.0'
    })

# ── 토스페이먼츠 결제 검증 + 운영 데이터 적재 ──────────────
@app.route('/proxy/toss/verify', methods=['POST'])
def toss_verify():
    """
    토스페이먼츠 결제 검증(서버사이드, TOSS_SECRET_KEY 설정 시) 후
    members/orders 테이블에 기록한다 (admin_site_plan.md Phase 0).
    TOSS_SECRET_KEY 미설정 시 검증 없이 테스트 모드로 기록만 남긴다.
    """
    try:
        body = request.get_json(force=True)
        payment_key = body.get('paymentKey')
        order_id    = body.get('orderId')
        amount      = body.get('amount')
        product     = body.get('product', 'premium')
        member      = body.get('member') or {}

        if amount is None:
            return jsonify({'error': '필수 파라미터 누락(amount)'}), 400

        # 실제 환경: 토스페이먼츠 서버 검증 API 호출
        # POST https://api.tosspayments.com/v1/payments/confirm
        TOSS_SECRET = os.environ.get('TOSS_SECRET_KEY', '')
        payment_result = None
        mode = 'test'

        if TOSS_SECRET and payment_key and order_id:
            mode = 'live'
            import base64, urllib.request
            credentials = base64.b64encode(f'{TOSS_SECRET}:'.encode()).decode()
            req = urllib.request.Request(
                'https://api.tosspayments.com/v1/payments/confirm',
                data=json.dumps({'paymentKey': payment_key, 'orderId': order_id, 'amount': amount}).encode(),
                headers={'Authorization': f'Basic {credentials}', 'Content-Type': 'application/json'},
                method='POST'
            )
            with urllib.request.urlopen(req) as resp:
                payment_result = json.loads(resp.read())
                # 요청 금액과 실제 결제 금액이 다르면 위변조 의심 → 기록하지 않고 거부
                if payment_result.get('totalAmount') != amount:
                    return jsonify({'error': '결제 금액 불일치'}), 400

        payment_method = payment_result.get('method') if payment_result else 'test'

        member_row = db.upsert_member(
            uid=member.get('uid'),
            name=member.get('name', ''),
            contact=member.get('email', ''),
            login_provider=member.get('provider', 'guest'),
        )
        order_row = db.insert_order(
            member_id=member_row['id'] if member_row else None,
            product=product,
            amount=amount,
            status='paid',
            toss_order_id=order_id,
            toss_payment_key=payment_key,
            payment_method=payment_method,
        )

        if order_row:
            db.insert_event('paid', session_id=member.get('uid'))

        resp_body = {'status': 'ok', 'mode': mode}
        if payment_result is not None:
            resp_body['payment'] = payment_result
        if order_row:
            resp_body['orderId'] = order_row['id']
        return jsonify(resp_body)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── 전환율 퍼널 이벤트 (Phase 2) ────────────────────────────
@app.route('/proxy/event', methods=['POST'])
def track_event():
    """
    self_done / premium_view / checkout_start 이벤트 기록.
    ('paid'는 /proxy/toss/verify 성공 시 서버가 직접 기록하므로 여기서 받지 않음)
    """
    try:
        body = request.get_json(force=True)
        name = body.get('name')
        if name not in ('self_done', 'premium_view', 'checkout_start'):
            return jsonify({'error': '알 수 없는 이벤트'}), 400
        db.insert_event(name, session_id=body.get('sessionId'))
        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── 무료 생성권 (어드민 "재발급" 시 부여) ────────────────────
# 실제 이메일/링크 재발급 대신, 로그인한 고객이 프리미엄 신청을 다시 결제 없이
# 1회 더 진행할 수 있는 "생성권"을 회원에게 부여하는 방식으로 바뀌었다(admin_site_plan.md).
@app.route('/proxy/credit/check')
def credit_check():
    uid = request.args.get('uid', '')
    member = db.get_member_by_uid(uid) if uid else None
    credits = (member or {}).get('bonus_credits') or 0
    return _no_cache(jsonify({'credits': credits}))


@app.route('/proxy/credit/consume', methods=['POST'])
def credit_consume():
    """
    생성권 1개를 소진하고, 결제 없이 프리미엄 보고서를 진행할 수 있도록
    amount=0인 orders 행을 만들어 반환한다(대시보드·주문목록에도 그대로 집계됨).
    """
    try:
        body = request.get_json(force=True)
        member = body.get('member') or {}
        uid = member.get('uid')
        if not uid:
            return jsonify({'error': '로그인이 필요합니다.'}), 401

        updated_member = db.consume_bonus_credit(uid)
        if not updated_member:
            return jsonify({'error': '사용 가능한 생성권이 없습니다.'}), 403

        order_row = db.insert_order(
            member_id=updated_member['id'],
            product='premium',
            amount=0,
            status='paid',
            payment_method='credit',
        )
        return jsonify({'status': 'ok', 'orderId': order_row['id'] if order_row else None})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── 고객문의 ──────────────────────────────────────────────
@app.route('/proxy/inquiry', methods=['POST'])
def inquiry_submit():
    """로그인한 고객이 문의를 등록한다. 특정 보고서에 대한 문의면 reportId를 함께 보낸다."""
    try:
        body = request.get_json(force=True)
        member = body.get('member') or {}
        message = (body.get('message') or '').strip()
        if not member.get('uid') or not message:
            return jsonify({'error': '로그인 후 문의 내용을 입력해주세요.'}), 400

        member_row = db.upsert_member(
            uid=member.get('uid'),
            name=member.get('name', ''),
            contact=member.get('email', ''),
            login_provider=member.get('provider', 'guest'),
        )
        if not member_row:
            return jsonify({'error': '문의 등록이 설정되지 않았습니다.'}), 503

        inquiry_row = db.insert_inquiry(
            member_id=member_row['id'],
            message=message[:2000],
            subject=(body.get('subject') or '').strip()[:200] or None,
            report_id=body.get('reportId') or None,
        )
        return jsonify({'status': 'ok', 'inquiryId': inquiry_row['id'] if inquiry_row else None})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/proxy/inquiry/mine')
def inquiry_mine():
    """로그인한 고객 본인의 문의 내역+답변 조회 (마이페이지)."""
    uid = request.args.get('uid', '')
    if not uid:
        return _no_cache(jsonify({'inquiries': []}))
    member = db.get_member_by_uid(uid)
    if not member:
        return _no_cache(jsonify({'inquiries': []}))
    return _no_cache(jsonify({'inquiries': db.get_inquiries_by_member(member['id'])}))


# ── 운영자 설정 조회 (Phase 3 — 가격/점검모드) ──────────────
@app.route('/api/settings')
def public_settings():
    """
    프론트(index.html)가 결제 모달 가격·점검모드 배너를 그리는 데 쓰는 공개 조회 API.
    쓰기는 어드민(Route Handler, service_role)에서만 하고 여기서는 절대 받지 않는다.
    DB 미설정/값 없음 시 코드에 내장된 기본값으로 안전하게 폴백한다.
    """
    pricing = db.get_setting('pricing', DEFAULT_PRICING)
    maintenance = db.get_setting('maintenance', DEFAULT_MAINTENANCE)
    return _no_cache(jsonify({'pricing': pricing, 'maintenance': maintenance}))


# ── 금기 한자 조회 (Phase 3 — 어드민 "금기 한자 관리") ──────
@app.route('/api/taboo-hanja')
def public_taboo_hanja():
    """
    프론트(name-search-worker.js)가 이름 후보 탐색 시 걸러낼 금기 한자 목록.
    DB 미설정/행 없음 시 코드 내장 기본값(DEFAULT_TABOO_HANJA)으로 폴백한다.
    """
    hanja_list = db.get_taboo_hanja()
    if hanja_list is None:
        hanja_list = DEFAULT_TABOO_HANJA
    return _no_cache(jsonify({'hanja': hanja_list}))


# ── 한자DB 검색·수정 이력 (Phase 3 — 어드민 "한자 DB 수정") ──
# data/hanja-db.js의 HANJA_DB_FULL(7000여 자, 505개 한글 음)은 정적 JS 파일이라
# Supabase로 통째로 옮기지 않는다. 대신 hanja_overrides 테이블에 "정정값"만 저장하고,
# 조회 시 원본 위에 겹쳐서 보여준다. 본 서비스(index.html)도 페이지 로드 시 이 정정값을
# 받아 메모리 상의 HANJA_DB_FULL에 그대로 패치해 검색 엔진에 반영한다.
_HANJA_DB_CACHE = None


def _load_hanja_db():
    global _HANJA_DB_CACHE
    if _HANJA_DB_CACHE is not None:
        return _HANJA_DB_CACHE
    try:
        content = (BASE_DIR / 'data' / 'hanja-db.js').read_text(encoding='utf-8')
        m = re.search(r'const HANJA_DB_FULL = (\{.*\});', content, re.S)
        _HANJA_DB_CACHE = json.loads(m.group(1)) if m else {}
    except Exception as e:
        print(f'[hanja] hanja-db.js 파싱 실패: {e}', file=sys.stderr)
        _HANJA_DB_CACHE = {}
    return _HANJA_DB_CACHE


@app.route('/api/hanja/search')
def hanja_search():
    """
    어드민 한자DB 검색(읽기 전용, 공개 — 개인정보 아님).
    q가 한글 음 1글자면 그 음 전체를, 아니면 그 한자를 포함하는 모든 (음,한자) 쌍을 반환.
    hanja_overrides가 있으면 겹쳐서 "현재 실제 적용 중인 값"을 함께 보여준다.
    """
    q = (request.args.get('q') or '').strip()
    if not q:
        return jsonify({'results': []})

    hanja_db = _load_hanja_db()
    overrides = {}
    for row in (db.get_hanja_overrides() or []):
        overrides[(row['kr'], row['hanja'])] = row

    def _to_result(kr, entry):
        ov = overrides.get((kr, entry['h']))
        return {
            'kr': kr,
            'h': entry['h'],
            'm': ov['m'] if ov and ov.get('m') is not None else entry.get('m'),
            's': ov['s'] if ov and ov.get('s') is not None else entry.get('s'),
            'o': ov['o'] if ov and ov.get('o') is not None else entry.get('o'),
            'baseM': entry.get('m'), 'baseS': entry.get('s'), 'baseO': entry.get('o'),
            'overridden': ov is not None,
        }

    results = []
    if q in hanja_db:
        results = [_to_result(q, entry) for entry in hanja_db[q]]
    else:
        for kr, entries in hanja_db.items():
            for entry in entries:
                if entry.get('h') == q:
                    results.append(_to_result(kr, entry))

    return _no_cache(jsonify({'results': results[:50]}))


@app.route('/api/hanja/overrides')
def public_hanja_overrides():
    """본 서비스(index.html)가 페이지 로드 시 받아 HANJA_DB_FULL에 패치하는 정정값 목록."""
    rows = db.get_hanja_overrides() or []
    return _no_cache(jsonify({'overrides': rows}))


# ── 보고서 생성 결과 저장 (Phase 0) ────────────────────────
@app.route('/proxy/report/save', methods=['POST'])
def report_save():
    """
    프론트(api/claude-report.js)가 조립한 최종 보고서(report_json)를
    reports 테이블에 저장한다. DB 미설정 시 no-op(200 반환, 보고서 열람에는 영향 없음).
    """
    try:
        body = request.get_json(force=True)
        report_row = db.insert_report(
            order_id=body.get('orderId'),
            baby_name_kr=body.get('babyNameKr', ''),
            baby_name_hanja=body.get('babyNameHanja', ''),
            birth_dt=body.get('birthDt'),
            gender=body.get('gender'),
            score=body.get('score'),
            report_json=body.get('reportJson'),
            special_request=body.get('specialRequest'),
        )
        return jsonify({'status': 'ok', 'reportId': report_row['id'] if report_row else None})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── 저장된 보고서 조회 (STEP 6 — report-view.html / 어드민 "디어네임에서 열기") ──
@app.route('/proxy/report/<report_id>', methods=['GET'])
def report_get(report_id):
    if not db.ENABLED:
        return jsonify({'error': '운영 데이터 조회가 설정되지 않았습니다.'}), 503
    report_row = db.get_report(report_id)
    if not report_row:
        return jsonify({'error': '보고서를 찾을 수 없습니다.'}), 404
    return jsonify({'status': 'ok', 'report': report_row})


@app.route('/report-view.html')
def report_view_page():
    return _no_cache(send_file(BASE_DIR / 'report-view.html'))


if __name__ == '__main__':
    print(f"DearName v2 서버 시작")
    print(f"  주소: http://localhost:{PORT}")
    print(f"  Claude:  {'[OK]' if API_KEY        else '[NO] ANTHROPIC_API_KEY 미설정 (소견서 생성 불가)'}")
    print(f"  Gemini:  {'[OK]' if GEMINI_API_KEY  else '[NO] GEMINI_API_KEY 미설정  (채팅 상담 불가)'}")
    print(f"  DB(운영):{'[OK]' if db.ENABLED       else '[NO] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 미설정 (운영 데이터 미적재)'}")
    print(f"  정적파일: {BASE_DIR}")
    app.run(host='0.0.0.0', port=PORT, debug=True)
