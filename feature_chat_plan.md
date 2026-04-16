# AI 작명 상담 채팅 기능 기획서

> 대상: AI 프리미엄 보고서(`#report-view`) 하단에 추가되는 실시간 LLM 채팅 상담 위젯

---

## 1. 개요 및 목적

| 항목 | 내용 |
|---|---|
| 기능명 | AI 작명 상담 채팅 |
| 위치 | `#report-view` 맨 하단 (하단 액션 버튼 위) |
| 목적 | 보고서를 읽다 생긴 추가 질문을 즉시 AI에게 묻고 답변 받기 |
| 효과 | 보고서 이해도 향상, 서비스 체류 시간 증가, 유저 만족도 향상 |

---

## 2. 유저 시나리오

```
1. 유저가 AI 프리미엄 보고서를 읽음
2. "왜 이 오행 조합이 좋은 건가요?" 같은 궁금증 발생
3. 보고서 하단 채팅창에 질문 입력
4. AI가 이 이름의 분석 데이터를 알고 있는 상태에서 맞춤 답변 생성
5. 대화 이어가기 가능 (멀티턴)
```

### 예시 질문 시나리오
- "왜 이 이름이 사주에 좋은가요?"
- "娜 자의 의미를 좀 더 풀어서 설명해줘"
- "물(水) 기운이 과다한 사주에서 이 이름이 어떻게 보완하나요?"
- "이름을 불러줄 때 발음 순서가 중요한 이유가 뭔가요?"
- "딸에게 이 이름을 지어주면 어떤 성격으로 자랄까요?"

---

## 3. 기술 아키텍처

### 3-1. 전체 흐름

```
[index.html 채팅 UI]
    ↓ POST /proxy/claude-chat
    {
      message: "유저 질문",
      context: { 이름 분석 데이터 전체 },
      history: [ {role, content} ... ]
    }
[server.py /proxy/claude-chat]
    ↓ Claude API 호출
    system: 분석 데이터 + 역할 프롬프트
    messages: 대화 히스토리 + 유저 질문
    ↓ 응답 반환
[index.html 채팅 UI]
    → 말풍선으로 표시
    → history에 추가
```

### 3-2. 컨텍스트 데이터 구조 (서버로 전송)

```js
const chatContext = {
  // 이름 기본 정보
  nameKr: "김나윤",
  nameHanja: "金娜奫",
  score: 92,
  tagline: "report.tagline",    // 철학적 태그라인

  // 사주
  saju: {
    year:  { gan: '乙', ji: '巳' },
    month: { gan: '己', ji: '卯' },
    day:   { gan: '癸', ji: '巳' },
    time:  { gan: '庚', ji: '申' }
  },

  // 오행 점수
  ohengScores: { 木: 25.0, 火: 18.0, 土: 16.75, 金: 26.5, 水: 13.75 },

  // 한자 분석
  hanja: [
    { char: '娜', kr: '나', meaning: '아름다울·우아할', oheng: '土', strokes: 10 },
    { char: '奫', kr: '윤', meaning: '물 깊고 맑을', oheng: '水', strokes: 15 }
  ],

  // 수리 4격
  suri: {
    won: { num: 25, name: '안강격', grade: '길' },
    hyeong: { num: 18, name: '발전격', grade: '길' },
    i: { num: 23, name: '혁신격', grade: '길' },
    jeong: { num: 33, name: '등룡격', grade: '길' }
  },

  // 발음 오행/음양
  pronounce: {
    oheng: '길',
    yinYang: '평'
  },

  // 보고서 핵심 스토리 (LLM이 생성한 것)
  stories: {
    saju: report.sajuStory,
    jawon: report.jawonStory,
    hanja: report.hanjaStory,
    sound: report.soundStory,
    suri: report.suriStory,
    conclusion: report.conclusionLetter
  }
};
```

### 3-3. server.py 신규 엔드포인트

```python
@app.route('/proxy/claude-chat', methods=['POST'])
def claude_chat():
    data = request.json
    user_message = data.get('message', '')
    context      = data.get('context', {})
    history      = data.get('history', [])   # [{role, content}, ...]

    system_prompt = build_chat_system_prompt(context)

    messages = history + [{"role": "user", "content": user_message}]

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        system=system_prompt,
        messages=messages
    )

    return jsonify({
        "reply": response.content[0].text,
        "usage": response.usage.output_tokens
    })


def build_chat_system_prompt(ctx):
    name    = ctx.get('nameKr','')
    hanja   = ctx.get('nameHanja','')
    score   = ctx.get('score','')
    tagline = ctx.get('tagline','')
    saju    = ctx.get('saju', {})
    scores  = ctx.get('ohengScores', {})
    suri    = ctx.get('suri', {})
    hanja_list = ctx.get('hanja', [])

    hanja_desc = '\n'.join([
        f"  - {h['char']}({h['kr']}): {h['meaning']} / {h['oheng']} 기운 / {h['strokes']}획"
        for h in hanja_list
    ])

    suri_desc = '\n'.join([
        f"  - {v['name']}({k}격 {v['num']}수): {v['grade']}"
        for k, v in suri.items()
    ])

    return f"""당신은 30년 경력의 최고 명리학 작명 전문가입니다.
현재 '{name}({hanja})' 이름의 AI 프리미엄 작명 보고서를 열람 중인 부모님과 채팅 상담을 진행합니다.

[분석된 이름 정보]
이름: {name} ({hanja}) — 종합 점수 {score}/100
핵심 메시지: {tagline}

사주 원국:
  연주 {saju.get('year',{}).get('gan','')}{saju.get('year',{}).get('ji','')} /
  월주 {saju.get('month',{}).get('gan','')}{saju.get('month',{}).get('ji','')} /
  일주 {saju.get('day',{}).get('gan','')}{saju.get('day',{}).get('ji','')} /
  시주 {saju.get('time',{}).get('gan','')}{saju.get('time',{}).get('ji','')}

오행 점수: 木{scores.get('木',0):.1f} 火{scores.get('火',0):.1f} 土{scores.get('土',0):.1f} 金{scores.get('金',0):.1f} 水{scores.get('水',0):.1f}

한자 풀이:
{hanja_desc}

수리 4격:
{suri_desc}

[답변 규칙]
- 채팅이므로 짧고 명확하게 (200자 내외, 길면 300자)
- 어려운 용어는 () 안에 풀이
- 친근하고 따뜻한 톤 유지
- 이 이름의 데이터를 근거로 구체적으로 답변
- 모든 답변은 한국어로
"""
```

---

## 4. 프론트엔드 UI 설계

### 4-1. 위치 및 레이아웃

```
[보고서 본문 끝]
[클로징 메시지 섹션]
[AI 작명 상담 채팅 섹션]  ← 여기 추가
[하단 액션 버튼 (공유/인쇄/이메일)]
```

### 4-2. UI 컴포넌트 구조

```html
<!-- AI 작명 상담 채팅 -->
<div id="report-chat-section" class="report-card" style="...">
  <div class="story-chapter-label">AI 작명 상담</div>
  <h2 class="section-title">궁금한 점을 물어보세요</h2>

  <!-- 예시 질문 chip -->
  <div id="chat-example-chips">
    <button onclick="sendChatChip(this)">이 이름이 왜 좋은가요?</button>
    <button onclick="sendChatChip(this)">한자 의미 더 설명해줘</button>
    <button onclick="sendChatChip(this)">성격/기질이 어떻게 될까요?</button>
    <button onclick="sendChatChip(this)">오행 보완 원리가 뭔가요?</button>
  </div>

  <!-- 메시지 목록 -->
  <div id="chat-messages"></div>

  <!-- 입력창 -->
  <div id="chat-input-area">
    <textarea id="chat-input" placeholder="질문을 입력하세요..." rows="1"></textarea>
    <button onclick="sendChatMessage()" id="chat-send-btn">전송</button>
  </div>

  <!-- 면책 문구 -->
  <p id="chat-disclaimer">AI 답변은 참고용이며 전문 작명가의 의견과 다를 수 있습니다.</p>
</div>
```

### 4-3. 말풍선 디자인

```
[AI 말풍선]  — 좌측, 금색 아이콘
[유저 말풍선] — 우측, 어두운 배경

AI:  ┌─────────────────────────────────┐
     │ 🔮 "김나윤"이라는 이름에서...    │
     └─────────────────────────────────┘
                     유저: ┌──────────┐
                           │ 왜요?    │
                           └──────────┘
```

---

## 5. JS 함수 설계 (index.html 인라인)

```js
// 채팅 상태
let _chatHistory = [];       // [{role:'user'|'assistant', content:'...'}]
let _chatContext = null;     // 현재 보고서 컨텍스트

// 보고서 렌더 시 컨텍스트 초기화
function _initChatContext(candidate, report, scores) {
    _chatHistory = [];
    _chatContext = {
        nameKr: ..., nameHanja: ..., score: ...,
        tagline: report.tagline || '',
        saju: _currentState._saju,
        ohengScores: scores,
        hanja: [...],
        suri: {...},
        stories: { saju: report.sajuStory, ... }
    };
    // 채팅창 초기화
    document.getElementById('chat-messages').innerHTML = '';
    // 예시 질문 chip 표시
    document.getElementById('chat-example-chips').style.display = 'flex';
}

// 예시 chip 클릭
function sendChatChip(btn) {
    document.getElementById('chat-input').value = btn.textContent;
    btn.closest('#chat-example-chips').style.display = 'none';
    sendChatMessage();
}

// 메시지 전송
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg || !_chatContext) return;

    input.value = '';
    _appendChatBubble('user', msg);
    _chatHistory.push({ role: 'user', content: msg });

    // 로딩 표시
    const loadingId = _appendChatBubble('assistant', '...', true);

    try {
        const res = await fetch('/proxy/claude-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: msg,
                context: _chatContext,
                history: _chatHistory.slice(-10)  // 최근 10턴만 전송
            })
        });
        const data = await res.json();
        _updateChatBubble(loadingId, data.reply);
        _chatHistory.push({ role: 'assistant', content: data.reply });
    } catch(e) {
        _updateChatBubble(loadingId, '답변 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
}

// 말풍선 추가
function _appendChatBubble(role, text, isLoading = false) {
    const id = 'cb_' + Date.now();
    const el = document.createElement('div');
    el.id = id;
    el.className = `chat-bubble chat-bubble-${role}`;
    el.innerHTML = isLoading
        ? '<span class="chat-loading">●●●</span>'
        : text.replace(/\n/g, '<br>');
    document.getElementById('chat-messages').appendChild(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return id;
}

function _updateChatBubble(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = text.replace(/\n/g, '<br>');
}
```

---

## 6. CSS 스타일

```css
/* 채팅 섹션 */
#report-chat-section { margin-top: 12px; }

/* 예시 질문 chip */
#chat-example-chips {
    display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;
}
#chat-example-chips button {
    background: #f1f5f9; border: 1px solid var(--border-light);
    color: var(--text-secondary); border-radius: 20px;
    padding: 8px 16px; font-size: 0.82rem; font-weight: 600; cursor: pointer;
    transition: all 0.2s;
}
#chat-example-chips button:hover { background: var(--bg-dark); color: white; }

/* 메시지 영역 */
#chat-messages {
    min-height: 80px; max-height: 400px; overflow-y: auto;
    padding: 8px 0; display: flex; flex-direction: column; gap: 12px;
}

/* 말풍선 */
.chat-bubble { max-width: 80%; border-radius: 16px; padding: 12px 16px;
               font-size: 0.92rem; line-height: 1.7; }
.chat-bubble-user {
    align-self: flex-end;
    background: var(--bg-dark); color: white;
    border-bottom-right-radius: 4px;
}
.chat-bubble-assistant {
    align-self: flex-start;
    background: #f8fafc; color: var(--text-primary);
    border: 1px solid var(--border-light);
    border-bottom-left-radius: 4px;
}
.chat-bubble-assistant::before {
    content: '🔮 '; font-size: 0.85rem;
}

/* 로딩 애니메이션 */
.chat-loading { display: inline-flex; gap: 4px; }
.chat-loading::after { content: ''; animation: chatDot 1.2s infinite; }

/* 입력창 */
#chat-input-area {
    display: flex; gap: 10px; align-items: flex-end;
    margin-top: 16px; padding-top: 16px;
    border-top: 1px solid var(--border-light);
}
#chat-input {
    flex: 1; border: 1px solid var(--border-light); border-radius: 12px;
    padding: 12px 16px; font-size: 0.92rem; resize: none;
    font-family: inherit; outline: none; min-height: 44px; max-height: 120px;
}
#chat-input:focus { border-color: var(--gold-dark); }
#chat-send-btn {
    background: var(--bg-dark); color: white; border: none;
    border-radius: 12px; padding: 12px 20px; font-size: 0.9rem;
    font-weight: 700; cursor: pointer; white-space: nowrap;
    transition: background 0.2s;
}
#chat-send-btn:hover { background: #334155; }

/* 면책 문구 */
#chat-disclaimer {
    font-size: 0.75rem; color: var(--text-muted);
    text-align: center; margin-top: 12px;
}
```

---

## 7. server.py 변경 사항

### 추가할 내용

1. `/proxy/claude-chat` 라우트 추가 (§3-3 참조)
2. `build_chat_system_prompt(ctx)` 헬퍼 함수 추가
3. 대화 히스토리 길이 제한: 최근 10턴 (클라이언트에서 slice)
4. 에러 핸들링: API 실패 시 `{"error": "...", "reply": null}` 반환

### 토큰 비용 추정

| 항목 | 토큰 수 |
|---|---|
| 시스템 프롬프트 (컨텍스트 포함) | ~600 토큰 |
| 대화 히스토리 (10턴) | ~1,000 토큰 |
| 유저 질문 | ~50 토큰 |
| AI 답변 생성 (max) | 600 토큰 |
| **1회 상담 총계** | **~2,250 토큰** |

→ claude-sonnet-4-6 기준 약 **$0.006/1회** (약 8원)

---

## 8. 구현 순서 (스프린트)

### Phase 1 — 기본 채팅 (MVP)
- [ ] `server.py`에 `/proxy/claude-chat` 엔드포인트 추가
- [ ] `index.html` 채팅 HTML/CSS 추가
- [ ] `_initChatContext()`, `sendChatMessage()` JS 함수 구현
- [ ] `_renderReportContent()` 끝에 `_initChatContext()` 호출 연결

### Phase 2 — UX 개선
- [ ] Enter 키 전송 지원 (Shift+Enter = 줄바꿈)
- [ ] 예시 질문 chip (4개) 구현
- [ ] 로딩 애니메이션 (`●●●` 점 3개 깜빡임)
- [ ] textarea 자동 높이 조절
- [ ] 채팅 히스토리 스크롤 자동 이동

### Phase 3 — 고도화 (선택)
- [ ] 스트리밍 응답 (SSE) — 실시간 타이핑 효과
- [ ] 채팅 내역 로컬 저장 (보고서와 함께)
- [ ] 채팅 이용 횟수 제한 (무료: 3회 / 구독: 무제한)
- [ ] 추천 후속 질문 chip 자동 생성

---

## 9. 접근 제어 (선택 기획)

| 유저 유형 | 채팅 가능 횟수 |
|---|---|
| 비회원 | 0회 (로그인 유도) |
| 무료 회원 | 3회/보고서 |
| 구독 회원 | 무제한 |

구현: `_chatCount` 카운터 → 제한 초과 시 구독 모달 표시

---

## 10. 주요 고려사항

- **보안**: 시스템 프롬프트에 API 키 절대 포함 금지 (server.py에서만 처리)
- **컨텍스트 크기**: 스토리 필드는 요약본만 전송 (500자 이내 truncate)
- **응답 품질**: `max_tokens: 600`으로 과도한 장문 방지
- **모바일**: textarea 높이 자동 조절, 키보드 올라올 때 스크롤 처리
- **에러 처리**: 네트워크 실패, API 오류, rate limit 각각 친화적 메시지
