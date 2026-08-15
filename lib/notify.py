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


def send_report_link(to_email, report_url, baby_name=''):
    """구매한 소견서를 다시 볼 수 있는 링크를 고객에게 보낸다.
    기기·브라우저가 바뀌어도 메일에서 다시 열 수 있게 하는 것이 목적이다."""
    if not ENABLED or not to_email or not report_url:
        return False

    name_part = f"{baby_name} " if baby_name else ""
    subject = f"[DearName] {name_part}작명 소견서 보관용 링크"
    body = (
        f"안녕하세요, DearName입니다.\n\n"
        f"요청하신 {name_part}작명 소견서를 아래 링크에서 다시 보실 수 있습니다.\n\n"
        f"{report_url}\n\n"
        f"이 링크는 결제일로부터 6개월간 유효합니다.\n"
        f"기간이 지나기 전에 필요한 내용은 따로 저장해 두시기를 권해드립니다.\n\n"
        f"문의: cs.crazystudio@gmail.com\n"
        f"— 크레이지스튜디오 주식회사\n"
    )

    msg = MIMEText(body, _charset='utf-8')
    msg['Subject'] = subject
    msg['From'] = SMTP_FROM
    msg['To'] = to_email

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as smtp:
            smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PASS)
            smtp.sendmail(SMTP_FROM, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f'[notify] 보고서 링크 메일 발송 실패: {e}', file=sys.stderr)
        return False


def send_suspension_notice(to_email, reason=''):
    """어드민이 회원 이용을 제한(정지)했을 때 본인에게 안내 메일을 보낸다."""
    if not ENABLED or not to_email:
        return False

    reason_part = f"\n사유: {reason}\n" if reason else "\n"
    subject = "[DearName] 서비스 이용이 제한되었습니다"
    body = (
        f"안녕하세요, DearName입니다.\n\n"
        f"회원님의 계정은 이용약관 위반 등의 사유로 서비스 이용이 제한되었습니다.{reason_part}\n"
        f"제한 사유에 이견이 있으시거나 문의사항이 있으시면 아래 연락처로 회신해 주세요.\n\n"
        f"문의: cs.crazystudio@gmail.com\n"
        f"— 크레이지스튜디오 주식회사\n"
    )
    msg = MIMEText(body, _charset='utf-8')
    msg['Subject'] = subject
    msg['From'] = SMTP_FROM
    msg['To'] = to_email
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as smtp:
            smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PASS)
            smtp.sendmail(SMTP_FROM, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f'[notify] 이용제한 안내 메일 발송 실패: {e}', file=sys.stderr)
        return False


def send_unsuspension_notice(to_email):
    """이용제한이 해제됐을 때 회원 본인에게 안내 메일을 보낸다."""
    if not ENABLED or not to_email:
        return False

    subject = "[DearName] 서비스 이용 제한이 해제되었습니다"
    body = (
        f"안녕하세요, DearName입니다.\n\n"
        f"회원님의 계정에 대한 서비스 이용 제한이 해제되어, 다시 정상적으로 이용하실 수 있습니다.\n\n"
        f"문의: cs.crazystudio@gmail.com\n"
        f"— 크레이지스튜디오 주식회사\n"
    )
    msg = MIMEText(body, _charset='utf-8')
    msg['Subject'] = subject
    msg['From'] = SMTP_FROM
    msg['To'] = to_email
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as smtp:
            smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PASS)
            smtp.sendmail(SMTP_FROM, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f'[notify] 이용제한 해제 안내 메일 발송 실패: {e}', file=sys.stderr)
        return False


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
