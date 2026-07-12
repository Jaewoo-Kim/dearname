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


def insert_order(member_id, product, amount, status='paid', toss_order_id=None, toss_payment_key=None):
    body = {
        'member_id': member_id,
        'product': product,
        'amount': amount,
        'status': status,
        'toss_order_id': toss_order_id,
        'toss_payment_key': toss_payment_key,
    }
    rows = _request('POST', 'orders', body=body)
    return _first(rows)


def insert_report(order_id, baby_name_kr, baby_name_hanja, birth_dt, gender, score, report_json):
    body = {
        'order_id': order_id,
        'baby_name_kr': baby_name_kr,
        'baby_name_hanja': baby_name_hanja,
        'birth_dt': birth_dt,
        'gender': gender,
        'score': score,
        'report_json': report_json,
    }
    rows = _request('POST', 'reports', body=body)
    return _first(rows)


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
