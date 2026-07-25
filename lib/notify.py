#!/usr/bin/env python3
# lib/notify.py — 컴플레인 접수 시 운영자 이메일 알림
#
# SMTP_HOST 미설정 시 조용히 no-op 처리되어 기존 서비스 동작에는 영향을 주지 않는다
# (lib/db.py의 Supabase 미설정 시 no-op 패턴과 동일).
#
# 환경변수:
#   SMTP_HOST, SMTP_PORT(기본 587), SMTP_USER, SMTP_PASS — 발신 계정
#   SMTP_FROM           — 발신자 표시 주소(미설정 시 SMTP_USER)
#   ADMIN_ALERT_EMAIL   — 알림 수신 주소(콤마로 여러 명 지정 가능)

import os
import smtplib
import sys
from email.mime.text import MIMEText

SMTP_HOST = os.environ.get('SMTP_HOST', '')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
SMTP_FROM = os.environ.get('SMTP_FROM', '') or SMTP_USER
ADMIN_ALERT_EMAIL = os.environ.get('ADMIN_ALERT_EMAIL', '')

ENABLED = bool(SMTP_HOST and SMTP_USER and SMTP_PASS and ADMIN_ALERT_EMAIL)

if not ENABLED:
    print('[notify] SMTP_HOST/SMTP_USER/SMTP_PASS/ADMIN_ALERT_EMAIL 미설정 → 컴플레인 이메일 알림 비활성화(no-op)', file=sys.stderr)


def send_complaint_alert(inquiry, member_name='', member_contact=''):
    """컴플레인 접수 시 운영자에게 이메일로 알린다. 실패해도 문의 접수 자체는 막지 않는다."""
    if not ENABLED or not inquiry:
        return False

    to_addrs = [addr.strip() for addr in ADMIN_ALERT_EMAIL.split(',') if addr.strip()]
    if not to_addrs:
        return False

    subject = f"[DearName] 컴플레인 접수 — {inquiry.get('subject') or '(제목 없음)'}"
    body = (
        f"컴플레인이 접수되었습니다.\n\n"
        f"작성자: {member_name or '(이름 없음)'} ({member_contact or '연락처 없음'})\n"
        f"분류: {inquiry.get('category') or '(미지정)'}\n"
        f"긴급도: {inquiry.get('priority') or 'normal'}\n\n"
        f"내용:\n{inquiry.get('message') or ''}\n\n"
        f"어드민에서 확인: /inquiries/{inquiry.get('id')}\n"
    )

    msg = MIMEText(body, _charset='utf-8')
    msg['Subject'] = subject
    msg['From'] = SMTP_FROM
    msg['To'] = ', '.join(to_addrs)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as smtp:
            smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PASS)
            smtp.sendmail(SMTP_FROM, to_addrs, msg.as_string())
        return True
    except Exception as e:
        print(f'[notify] 컴플레인 알림 이메일 발송 실패: {e}', file=sys.stderr)
        return False
