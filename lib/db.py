#!/usr/bin/env python3
# lib/db.py — Supabase 운영 데이터 적재 (admin_site_plan.md Phase 0)
#
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정 시 모든 함수가 조용히 no-op
# 처리되어 기존 서비스 동작에는 전혀 영향을 주지 않는다.
#
# 별도 SDK 의존성 없이 Supabase REST(PostgREST)를 urllib으로 직접 호출한다
# (server.py의 토스페이먼츠 연동과 동일한 패턴).
#
# 테이블 스키마: supabase/schema.sql 참고.

import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

ENABLED = bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)

if not ENABLED:
    print('[db] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 미설정 → 운영 데이터 적재 비활성화(no-op)', file=sys.stderr)


def _request(method, path, body=None, params=None, prefer='return=representation'):
    """Supabase REST(PostgREST) 호출. 실패 시 None 반환(서비스 동작을 막지 않음)."""
    if not ENABLED:
        return None

    url = f'{SUPABASE_URL}/rest/v1/{path}'
    if params:
        query = '&'.join(f'{k}={v}' for k, v in params.items())
        url = f'{url}?{query}'

    headers = {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json',
    }
    if prefer:
        headers['Prefer'] = prefer

    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', errors='ignore')
        print(f'[db] {method} {path} 실패: {e.code} {detail}', file=sys.stderr)
        return None
    except Exception as e:
        print(f'[db] {method} {path} 오류: {e}', file=sys.stderr)
        return None


def _first(rows):
    return rows[0] if rows else None


def upsert_member(uid, name='', contact='', login_provider='guest'):
    """회원 upsert. uid(프론트 dn_user_key 또는 소셜 로그인 sub)로 식별."""
    if not uid:
        return None
    body = {
        'external_uid': uid,
        'name': name or None,
        'contact': contact or None,
        'login_provider': login_provider or 'guest',
    }
    rows = _request(
        'POST', 'members', body=body,
        params={'on_conflict': 'external_uid'},
        prefer='return=representation,resolution=merge-duplicates',
    )
    return _first(rows)


def insert_order(member_id, product, amount, status='paid', toss_order_id=None, toss_payment_key=None, payment_method=None):
    body = {
        'member_id': member_id,
        'product': product,
        'amount': amount,
        'status': status,
        'toss_order_id': toss_order_id,
        'toss_payment_key': toss_payment_key,
        'payment_method': payment_method,
    }
    rows = _request('POST', 'orders', body=body)
    return _first(rows)


def insert_report(order_id, baby_name_kr, baby_name_hanja, birth_dt, gender, score, report_json, special_request=None):
    body = {
        'order_id': order_id,
        'baby_name_kr': baby_name_kr,
        'baby_name_hanja': baby_name_hanja,
        'birth_dt': birth_dt,
        'gender': gender,
        'score': score,
        'report_json': report_json,
        'special_request': special_request or None,
    }
    rows = _request('POST', 'reports', body=body)
    return _first(rows)


def get_report(report_id):
    """ID로 저장된 보고서 조회 (report-view.html / 어드민 "디어네임에서 열기"용)."""
    if not report_id:
        return None
    rows = _request('GET', 'reports', params={'id': f'eq.{report_id}', 'select': '*'}, prefer=None)
    return _first(rows)


def insert_event(name, session_id=None):
    """전환율 퍼널 이벤트 기록 (Phase 2 — self_done/premium_view/checkout_start/paid)."""
    if not name:
        return None
    body = {'name': name, 'session_id': session_id}
    rows = _request('POST', 'events', body=body)
    return _first(rows)


def get_setting(key, default=None):
    """운영자 설정 조회 (Phase 3 — pricing/maintenance 등). DB 미설정/행 없으면 default 반환."""
    rows = _request('GET', 'settings', params={'key': f'eq.{key}', 'select': 'value'}, prefer=None)
    row = _first(rows)
    return row['value'] if row else default


def get_taboo_hanja():
    """금기 한자 목록 조회 (Phase 3). DB 미설정/행 없으면 None(호출부에서 기본값 폴백)."""
    rows = _request('GET', 'taboo_hanja', params={'select': 'hanja'}, prefer=None)
    if not rows:
        return None
    return [r['hanja'] for r in rows]


def get_hanja_overrides():
    """한자DB 정정값 전체 조회 (Phase 3 — 어드민 "한자 DB 수정"). DB 미설정 시 빈 리스트."""
    return _request('GET', 'hanja_overrides', params={'select': '*'}, prefer=None) or []


def get_member_by_uid(uid):
    """external_uid(프론트 dn_user_key 또는 소셜 로그인 sub)로 회원 조회."""
    if not uid:
        return None
    rows = _request('GET', 'members', params={'external_uid': f'eq.{uid}', 'select': '*'}, prefer=None)
    return _first(rows)


def withdraw_member(uid):
    """
    회원탈퇴. name/contact/external_uid를 비우고 잔여 무료 생성권을 0으로 만든 뒤
    withdrawn_at을 기록한다. 주문·보고서 등 전자상거래법상 보존이 필요한 거래기록은
    member_id로 계속 연결되어 있지만, 그 회원의 이름·연락처는 더 이상 조회되지 않는다.
    external_uid를 비워 같은 소셜 계정으로 재가입 시 새 회원으로 생성되게 한다.
    """
    member = get_member_by_uid(uid)
    if not member:
        return None
    rows = _request(
        'PATCH', 'members',
        body={
            'name': None,
            'contact': None,
            'external_uid': None,
            'bonus_credits': 0,
            'withdrawn_at': datetime.now(timezone.utc).isoformat(),
        },
        params={'id': f'eq.{member["id"]}'},
    )
    return _first(rows)


def consume_bonus_credit(uid):
    """
    어드민이 재발급으로 부여한 무료 생성권 1개를 소진한다(CAS).
    조회 시점의 bonus_credits 값을 조건으로 걸어 갱신하므로, 동시 요청으로 인한
    중복 소진(잔여 1개인데 두 번 생성)을 막는다 — 환불의 CAS 패턴과 동일.
    성공 시 갱신된 member row, 잔여 0 또는 경합으로 실패 시 None.
    """
    member = get_member_by_uid(uid)
    if not member or (member.get('bonus_credits') or 0) <= 0:
        return None
    current = member['bonus_credits']
    rows = _request(
        'PATCH', 'members',
        body={'bonus_credits': current - 1},
        params={'external_uid': f'eq.{uid}', 'bonus_credits': f'eq.{current}'},
    )
    return _first(rows)


def insert_inquiry(member_id, message, subject=None, report_id=None, type='general', category=None, priority='normal', order_id=None):
    """고객문의/컴플레인 등록. member_id는 upsert_member로 먼저 확보한 값이어야 한다."""
    if not member_id or not message:
        return None
    body = {
        'member_id': member_id,
        'report_id': report_id,
        'subject': subject or None,
        'message': message,
        'type': type,
        'category': category or None,
        'priority': priority,
        'order_id': order_id or None,
    }
    rows = _request('POST', 'inquiries', body=body)
    return _first(rows)


def get_inquiries_by_member(member_id):
    """고객 본인의 문의 내역+답변 조회 (마이페이지용). 최신순."""
    if not member_id:
        return []
    rows = _request(
        'GET', 'inquiries',
        params={'member_id': f'eq.{member_id}', 'select': '*', 'order': 'created_at.desc'},
        prefer=None,
    )
    return rows or []


def get_orders_by_member(member_id):
    """고객 본인의 결제 내역 조회 (컴플레인 접수 시 관련 결제건 선택용). 최신순."""
    if not member_id:
        return []
    rows = _request(
        'GET', 'orders',
        params={'member_id': f'eq.{member_id}', 'select': '*', 'order': 'created_at.desc'},
        prefer=None,
    )
    return rows or []


def get_reports_by_uid(uid):
    """
    고객 본인의 AI 보고서 조회 (마이페이지 재열람용). 최신순.
    reports에는 member_id가 없고 order_id만 있으므로 members → orders → reports 순으로 훑는다.
    주문 기록이 실패해 order_id가 없는 보고서는 소유자를 특정할 수 없어 조회되지 않는다.
    """
    if not uid:
        return []
    member = get_member_by_uid(uid)
    if not member:
        return []
    orders = get_orders_by_member(member['id'])
    order_ids = [o['id'] for o in orders if o.get('id')]
    if not order_ids:
        return []
    rows = _request(
        'GET', 'reports',
        params={
            'order_id': f'in.({",".join(order_ids)})',
            'select': '*',
            'order': 'created_at.desc',
        },
        prefer=None,
    )
    return rows or []


# 대략적인 추정 단가(USD, 1M 토큰당) — 정확한 원가 산정용이 아닌 마진 모니터링 참고치
_PRICE_PER_M = {
    'claude-sonnet-4-20250514': (3.0, 15.0),
    'claude-sonnet-4-6':        (3.0, 15.0),
    'claude-haiku-4-5-20251001': (0.8, 4.0),
    'gemini-2.0-flash':         (0.0, 0.0),  # 무료 티어
}


def insert_ai_usage(kind, model, input_tokens=0, output_tokens=0):
    in_price, out_price = _PRICE_PER_M.get(model, (0.0, 0.0))
    est_cost_usd = (input_tokens * in_price + output_tokens * out_price) / 1_000_000
    body = {
        'kind': kind,
        'model': model,
        'input_tokens': input_tokens,
        'output_tokens': output_tokens,
        'est_cost_usd': round(est_cost_usd, 6),
    }
    rows = _request('POST', 'ai_usage', body=body)
    return _first(rows)
