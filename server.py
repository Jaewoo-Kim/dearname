#!/usr/bin/env python3
# server.py — DearName v2 로컬/배포 서버
# Claude API 프록시 + 정적 파일 서빙
#
# 사용법:
#   pip install anthropic flask flask-cors
#   ANTHROPIC_API_KEY=sk-... python server.py
#
# 배포: Render / Railway / Vercel(서버리스) 모두 지원
# 환경변수: ANTHROPIC_API_KEY (필수), PORT (기본 3000)

import os, json, sys
from pathlib import Path

try:
    from flask import Flask, request, jsonify, send_from_directory, send_file, Response
    from flask_cors import CORS
    import anthropic
except ImportError:
    print("필수 패키지 설치:")
    print("  pip install flask flask-cors anthropic")
    sys.exit(1)

# ── 설정 ─────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
PORT       = int(os.environ.get('PORT', 3000))
API_KEY    = os.environ.get('ANTHROPIC_API_KEY', '')
CLIENT     = anthropic.Anthropic(api_key=API_KEY) if API_KEY else None

app = Flask(__name__, static_folder=str(BASE_DIR))
CORS(app, origins=['http://localhost:*', 'https://*.dearname.kr', 'https://*.onrender.com'])

# ── 정적 파일 서빙 ────────────────────────────────────────
@app.route('/')
def index():
    return send_file(BASE_DIR / 'index.html')

@app.route('/config.js')
def config_js():
    return send_file(BASE_DIR / 'config.js')

@app.route('/data/<path:filename>')
def data_files(filename):
    return send_from_directory(BASE_DIR / 'data', filename)

@app.route('/lib/<path:filename>')
def lib_files(filename):
    return send_from_directory(BASE_DIR / 'lib', filename)

@app.route('/api/<path:filename>')
def api_files(filename):
    # api/claude-report.js 같은 정적 파일
    return send_from_directory(BASE_DIR / 'api', filename)

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

        return jsonify({
            'content': [{'type': 'text', 'text': response.content[0].text}]
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


# ── 헬스체크 ─────────────────────────────────────────────
@app.route('/health')
def health():
    return jsonify({
        'status': 'ok',
        'api_key': 'set' if API_KEY else 'missing',
        'version': 'v2.0.0'
    })

# ── 토스페이먼츠 결제 검증 (선택적) ──────────────────────
@app.route('/proxy/toss/verify', methods=['POST'])
def toss_verify():
    """
    토스페이먼츠 결제 검증 (서버사이드)
    실서비스에서는 여기서 DB에 결제 기록 저장
    """
    try:
        body = request.get_json(force=True)
        payment_key = body.get('paymentKey')
        order_id    = body.get('orderId')
        amount      = body.get('amount')

        if not all([payment_key, order_id, amount]):
            return jsonify({'error': '필수 파라미터 누락'}), 400

        # 실제 환경: 토스페이먼츠 서버 검증 API 호출
        # POST https://api.tosspayments.com/v1/payments/confirm
        TOSS_SECRET = os.environ.get('TOSS_SECRET_KEY', '')
        if not TOSS_SECRET:
            # 테스트 모드: 검증 없이 통과
            return jsonify({'status': 'ok', 'mode': 'test'})

        import base64, urllib.request
        credentials = base64.b64encode(f'{TOSS_SECRET}:'.encode()).decode()
        req = urllib.request.Request(
            'https://api.tosspayments.com/v1/payments/confirm',
            data=json.dumps({'paymentKey': payment_key, 'orderId': order_id, 'amount': amount}).encode(),
            headers={'Authorization': f'Basic {credentials}', 'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            return jsonify({'status': 'ok', 'payment': result})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print(f"DearName v2 서버 시작")
    print(f"  주소: http://localhost:{PORT}")
    print(f"  API키: {'[OK] 설정됨' if API_KEY else '[NO] 미설정 (ANTHROPIC_API_KEY 필요)'}")
    print(f"  정적파일: {BASE_DIR}")
    app.run(host='0.0.0.0', port=PORT, debug=not API_KEY)
