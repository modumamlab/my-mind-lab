console.info('[MML] ASSESSMENT-REPORTS-MODULE-V28 loaded');

function detailedReportTemplate(testType, reportType) {
  const admin = reportType === "관리자용";

  const templates = {
    "TCI": {
      summary: admin
        ? `【TCI 관리자용 임상 소견】

1. 기질 프로파일
- 자극추구(NS):
- 위험회피(HA):
- 사회적 민감성(RD):
- 인내력(P):

2. 성격 프로파일
- 자율성(SD):
- 연대감(C):
- 자기초월(ST):

3. 사례개념화
- 주요 주호소:
- 반복되는 정서·행동 패턴:
- 스트레스 상황에서의 반응:
- 대인관계에서의 특징:

4. 임상적 주의점
- 위험 신호:
- 방어/회피 양상:
- 상담 저항 가능성:
`
        : `【TCI 기질 및 성격검사 결과 요약】

TCI는 타고난 기질과 후천적으로 발달한 성격을 함께 살펴보는 검사입니다.
이번 결과는 현재의 정서 반응, 스트레스 대처 방식, 대인관계 패턴을 이해하는 데 도움을 줍니다.

1. 기질 이해
- 자극추구:
- 위험회피:
- 사회적 민감성:
- 인내력:

2. 성격 이해
- 자율성:
- 연대감:
- 자기초월:

3. 현재 마음의 특징
`,
      strength: `【강점 및 자원】

- 자신의 반응 패턴을 이해하려는 동기가 있습니다.
- 기질적 특성을 알면 스트레스 상황에서 스스로를 덜 비난하고 조절 전략을 찾을 수 있습니다.
- 성격 자원은 상담과 일상 실천을 통해 확장될 수 있습니다.
`,
      caution: `【주의점 및 어려움】

- 특정 기질이 높거나 낮을 때 스트레스 상황에서 반복되는 반응이 나타날 수 있습니다.
- 정서적 예민함, 회피, 충동성, 관계 피로감 등이 개인에 따라 다르게 나타날 수 있습니다.
- 검사 결과는 고정된 성격 판단이 아니라 자기이해를 위한 자료입니다.
`,
      plan: `【상담 제안】

1. 기질을 바꾸려 하기보다 이해하고 조율하기
2. 스트레스 상황에서 자동으로 나타나는 반응 알아차리기
3. 대인관계에서 반복되는 패턴 탐색하기
4. 생활 속 자기조절 전략 만들기
5. 필요 시 추가검사 또는 심리상담 연계
`
    },

    "STS": {
      summary: admin
        ? `【STS 관리자용 해석】

1. 6요인 프로파일
- 정서성:
- 활동성:
- 사회성:
- 수줍음:
- 주의집중:
- 지속성:

2. 기질적 강점
3. 환경 적합성
4. 상담 및 양육/지도 시 고려점
`
        : `【STS 6요인 기질검사 결과 요약】

STS는 개인의 기질적 특성을 6가지 요인으로 살펴보는 검사입니다.
기질은 좋고 나쁨의 문제가 아니라, 환경과 만났을 때 어떻게 드러나는지를 이해하는 것이 중요합니다.

1. 정서 반응
2. 활동 수준
3. 사회적 접근성
4. 낯선 상황에서의 반응
5. 주의집중
6. 지속성
`,
      strength: `【강점】

- 타고난 기질을 이해하면 자신에게 맞는 환경과 대처 방식을 찾을 수 있습니다.
- 강점 기질은 학습, 관계, 일상 적응의 자원이 될 수 있습니다.
`,
      caution: `【주의점】

- 기질과 환경이 맞지 않을 때 피로감이나 갈등이 커질 수 있습니다.
- 특정 기질을 문제로 보기보다 조절과 환경 조율의 관점에서 이해해야 합니다.
`,
      plan: `【제안】

- 기질에 맞는 생활 리듬 만들기
- 정서 반응을 알아차리는 연습
- 관계 상황에서 무리하지 않는 자기표현 연습
- 필요 시 부모/교사/상담자와 환경 조율
`
    },

    "PAT": {
      summary: admin
        ? `【PAT 부모양육태도검사 관리자용 해석】

1. 양육태도 주요 프로파일
- 지지/수용:
- 자율성 존중:
- 일관성:
- 통제/지시:
- 과보호:
- 성취압력:
- 정서적 반응성:

2. 양육 스트레스 및 상호작용 가설
- 부모가 어려움을 느끼는 상황:
- 반복되는 양육 갈등 장면:
- 부모의 기대와 자녀 반응의 불일치:
- 양육자의 정서 소진 가능성:

3. 상담/코칭에서 확인할 내용
- 양육 신념:
- 훈육 방식:
- 부부/가족 내 양육 일관성:
- 부모 자신의 성장경험과 양육 반응의 연결:
`
        : `【PAT 부모양육태도검사 결과 요약】

PAT는 부모님의 양육태도와 자녀를 대하는 방식을 살펴보는 검사입니다.
이 결과는 부모를 평가하기 위한 것이 아니라, 현재 양육에서 도움이 되는 부분과 조율이 필요한 부분을 함께 찾기 위한 자료입니다.

1. 현재 양육태도의 특징
- 자녀를 지지하고 수용하는 방식:
- 자율성을 허용하는 정도:
- 규칙과 한계를 제시하는 방식:
- 훈육과 통제의 균형:

2. 부모-자녀 관계에서 나타날 수 있는 모습
`,
      strength: `【양육 강점】

- 자녀를 이해하려는 관심과 참여가 중요한 강점입니다.
- 부모가 자신의 양육 방식을 점검하려는 태도는 관계 변화의 출발점이 됩니다.
- 일상 속 작은 반응 변화만으로도 자녀의 안정감과 협력 행동이 달라질 수 있습니다.

구체적 강점:
1.
2.
3.
`,
      caution: `【주의점 및 조율이 필요한 부분】

- 부모의 기대 수준과 자녀의 발달 수준이 다를 경우 갈등이 커질 수 있습니다.
- 통제와 허용의 균형이 맞지 않으면 자녀가 혼란을 느낄 수 있습니다.
- 부모의 피로와 스트레스가 높을 때 일관된 양육 반응이 어려워질 수 있습니다.

확인할 부분:
1.
2.
3.
`,
      plan: `【양육코칭 제안】

1. 아이의 행동을 ‘문제’보다 ‘신호’로 바라보기
2. 짧고 구체적인 지시 사용하기
3. 제한은 분명하게, 감정은 따뜻하게 반응하기
4. 긍정 행동을 즉시 알아차리고 강화하기
5. 부모의 감정 조절과 회복 시간을 함께 확보하기
6. 가정 내 양육 원칙을 간단하게 정리하기
`
    },

    "KCDI": {
      summary: admin
        ? `【KCDI 아동발달검사 관리자용 해석】

1. 발달 영역별 결과
- 사회성:
- 자조행동:
- 대근육:
- 소근육:
- 표현언어:
- 언어이해:
- 글자/숫자:
- 정서/행동:
- 전체 발달 수준:

2. 관찰 및 면담에서 확인할 내용
- 또래 및 성인과의 상호작용:
- 일상생활 적응:
- 언어적 요구 표현:
- 감각/행동 특성:
- 놀이 수준:
- 정서조절 및 전환 어려움:

3. 발달 지원 필요성
- 추가 관찰 필요 영역:
- 부모 상담 포인트:
- 기관/어린이집 협력 사항:
- 전문기관 연계 필요성:
`
        : `【KCDI 아동발달검사 결과 요약】

KCDI는 자녀의 현재 발달 특성을 여러 영역에서 살펴보는 검사입니다.
이 결과는 아이의 발달을 단정하기 위한 것이 아니라, 아이에게 필요한 지원과 환경을 찾기 위한 자료입니다.

1. 발달 영역별 이해
- 사회성:
- 자조행동:
- 대근육:
- 소근육:
- 표현언어:
- 언어이해:
- 글자/숫자:
- 정서/행동:

2. 현재 아이에게 필요한 지원
`,
      strength: `【아이의 강점 및 자원】

- 아이가 잘하고 있는 영역을 먼저 확인하는 것이 중요합니다.
- 강점 영역은 부족한 영역을 돕는 발판이 될 수 있습니다.
- 발달은 속도의 차이가 있으므로 현재 수준에 맞춘 지원이 필요합니다.

강점으로 볼 수 있는 부분:
1.
2.
3.
`,
      caution: `【주의 깊게 볼 부분】

- 특정 발달 영역에서 지연 또는 어려움이 의심될 경우 지속적인 관찰이 필요합니다.
- 언어, 사회성, 정서조절, 일상생활 적응은 서로 연결되어 나타날 수 있습니다.
- 검사 결과만으로 단정하지 않고 실제 관찰과 부모 면담을 함께 고려해야 합니다.

추가 확인이 필요한 부분:
1.
2.
3.
`,
      plan: `【발달 지원 제안】

1. 아이의 현재 발달 수준에 맞춘 상호작용 제공
2. 짧고 반복적인 언어 자극 사용
3. 놀이 속에서 요구하기, 기다리기, 주고받기 연습
4. 성공 경험을 작게 나누어 제공하기
5. 가정과 기관이 같은 목표로 일관되게 지원하기
6. 필요 시 발달평가 또는 전문기관 상담 연계
`
    },

    "PAT · KCDI": {
      summary: admin
        ? `【PAT·KCDI 통합 관리자용 종합 소견】

1. PAT 부모양육태도 요약
- 지지/수용:
- 자율성 존중:
- 일관성:
- 통제/지시:
- 과보호/성취압력:
- 양육 스트레스:

2. KCDI 아동발달 요약
- 사회성:
- 자조행동:
- 대근육/소근육:
- 표현언어/언어이해:
- 인지/학습 기초:
- 정서/행동:

3. 부모-자녀 상호작용 가설
- 부모의 양육 반응과 자녀 발달 특성의 맞물림:
- 갈등 또는 어려움이 반복되는 장면:
- 자녀의 발달 신호를 부모가 해석하는 방식:
- 부모가 조율해야 할 기대 수준:

4. 코칭 우선순위
- 1순위:
- 2순위:
- 3순위:
`
        : `【부모-자녀 모두맘 통합 결과 요약】

부모-자녀 모두맘은 부모님의 양육태도(PAT)와 자녀의 발달 특성(KCDI)을 함께 살펴봅니다.
부모와 자녀를 따로 평가하기보다, 서로의 특성과 상호작용을 통합적으로 이해하는 데 목적이 있습니다.

1. 부모 양육태도 이해
- 부모가 자녀에게 반응하는 방식:
- 규칙과 자율성의 균형:
- 지지와 훈육의 균형:

2. 자녀 발달 특성 이해
- 현재 잘 발달하고 있는 영역:
- 지원이 필요한 영역:
- 일상에서 관찰할 부분:

3. 부모-자녀 상호작용
- 서로 잘 맞는 부분:
- 조율이 필요한 부분:
`,
      strength: `【가족의 강점 및 자원】

- 부모가 자녀를 이해하려는 관심과 참여가 중요한 자원입니다.
- 자녀의 발달 특성을 이해하면 양육 기대를 현실적으로 조율할 수 있습니다.
- 부모-자녀 관계는 작은 상호작용 변화만으로도 긍정적 변화가 나타날 수 있습니다.

강점:
1.
2.
3.
`,
      caution: `【주의점 및 조율이 필요한 부분】

- 자녀의 발달 속도와 부모의 기대 수준이 다를 때 갈등이 커질 수 있습니다.
- 아이의 행동을 의도적 문제로만 해석하면 상호작용이 경직될 수 있습니다.
- 부모의 피로와 양육 스트레스도 함께 살펴볼 필요가 있습니다.
- 발달 특성은 양육태도와 상호작용하며 나타날 수 있습니다.

조율이 필요한 부분:
1.
2.
3.
`,
      plan: `【통합 양육코칭 제안】

1. 아이의 발달 수준에 맞는 기대 설정
2. 부모의 지시를 짧고 구체적으로 조정
3. 긍정 행동 즉시 강화
4. 감정 이름 붙이기와 공감 반응 연습
5. 놀이 기반 상호작용 시간 확보
6. 가정과 기관의 일관된 지원 목표 설정
7. 필요 시 발달평가 또는 전문기관 연계
`
    },

    "MMPI-2": {
      summary: admin
        ? `【MMPI-2 관리자용 임상 해석】

1. 타당도 척도
- L:
- F:
- K:
- VRIN/TRIN:

2. 임상척도
- Hs:
- D:
- Hy:
- Pd:
- Mf:
- Pa:
- Pt:
- Sc:
- Ma:
- Si:

3. 코드타입 및 임상적 가설
4. 위험 신호
5. 면담에서 확인할 내용
`
        : `【MMPI-2 결과 요약】

MMPI-2는 현재 심리적 불편감, 정서 상태, 사고 및 대인관계 특성을 폭넓게 살펴보는 검사입니다.
결과는 진단을 확정하기 위한 것이 아니라, 상담에서 더 깊이 이해해야 할 영역을 찾는 데 활용됩니다.

1. 현재 정서 상태
2. 스트레스 반응
3. 대인관계 특성
4. 상담에서 다룰 주요 주제
`,
      strength: `【강점 및 보호요인】

- 자신의 어려움을 점검하고 도움을 요청하려는 시도 자체가 중요한 보호요인입니다.
- 검사 결과를 통해 막연한 어려움을 구체화할 수 있습니다.
`,
      caution: `【주의점】

- 높은 척도가 있다면 현재 심리적 부담이 크다는 신호일 수 있습니다.
- 위기 신호, 우울, 불안, 충동성, 현실검증력 관련 내용은 면담으로 추가 확인이 필요합니다.
`,
      plan: `【상담 제안】

1. 주호소와 검사 결과의 일치 여부 확인
2. 정서 안정화 및 위기 신호 점검
3. 반복되는 사고·감정·행동 패턴 탐색
4. 필요 시 정신건강의학과 또는 전문기관 연계
`
    },

    "SCT": {
      summary: `【SCT 문장완성검사 결과 요약】

SCT는 미완성 문장을 완성하는 방식으로 개인의 생각, 감정, 관계 경험, 자기개념을 탐색하는 검사입니다.

1. 자기이해 영역
2. 가족 및 관계 영역
3. 정서 표현
4. 미래 기대 및 욕구
`,
      strength: `【강점】

- 문장 속에 드러난 욕구와 자원을 확인할 수 있습니다.
- 말로 표현하기 어려운 감정이 간접적으로 드러날 수 있습니다.
`,
      caution: `【주의점】

- 반복적으로 나타나는 부정적 자기평가, 불안, 분노, 회피 표현은 상담에서 추가 탐색이 필요합니다.
`,
      plan: `【상담 제안】

- 핵심 문장 함께 살펴보기
- 반복되는 관계 주제 탐색
- 미표현 감정 언어화
- 자기이해와 자기수용 작업
`
    },

    "HTP": {
      summary: `【HTP 그림검사 결과 요약】

HTP는 집, 나무, 사람 그림을 통해 자기상, 정서 상태, 대인관계 경험을 탐색하는 투사적 검사입니다.

1. 집 그림: 환경과 안정감
2. 나무 그림: 자기 에너지와 성장감
3. 사람 그림: 자기상과 관계 표현
`,
      strength: `【강점】

- 언어로 표현하기 어려운 정서와 경험을 그림을 통해 탐색할 수 있습니다.
- 그림 해석은 면담과 함께 통합적으로 이해할 때 의미가 커집니다.
`,
      caution: `【주의점】

- 그림만으로 단정적 해석을 하지 않습니다.
- 크기, 압력, 생략, 위치 등은 면담 내용과 함께 확인해야 합니다.
`,
      plan: `【상담 제안】

- 그림에 담긴 느낌과 이야기 나누기
- 안전감, 자기상, 관계 경험 탐색
- 필요 시 SCT 또는 MMPI 등 추가검사와 통합
`
    },

    "통합": {
      summary: `【통합 심리검사 결과 요약】

여러 검사 결과와 상담 내용을 종합하여 현재 마음 상태, 주요 어려움, 강점, 상담 방향을 정리합니다.

1. 현재 주호소
2. 정서 및 스트레스 반응
3. 성격 및 기질 특성
4. 관계 패턴
5. 상담에서 우선적으로 다룰 주제
`,
      strength: `【강점 및 자원】

- 자기이해를 위한 동기
- 변화 가능성
- 관계적 자원
- 회복을 돕는 생활 자원
`,
      caution: `【주의점】

- 반복되는 정서적 어려움
- 대인관계 갈등 패턴
- 회피 또는 과잉노력
- 위기 신호 여부
`,
      plan: `【상담 계획】

1. 초기 안정화
2. 핵심 패턴 이해
3. 검사 해석상담
4. 일상 실천과제
5. 사후관리 및 재평가
`
    }
  };

  return templates[testType] || templates["통합"];
}




function modumamReportTemplate(testType){
  const common = {
    "TCI": {
      summary:`【TCI 기질 및 성격검사 종합 소견】

1. 기질 프로파일
- 자극추구(NS):
- 위험회피(HA):
- 사회적 민감성(RD):
- 인내력(P):

2. 성격 프로파일
- 자율성(SD):
- 연대감(C):
- 자기초월(ST):

3. 현재 마음의 특징
`,
      strength:`【강점 및 자원】

- 자신의 반응 패턴을 이해하려는 동기가 있습니다.
- 기질적 특성을 알면 스트레스 상황에서 스스로를 덜 비난하고 조절 전략을 찾을 수 있습니다.
- 성격 자원은 상담과 일상 실천을 통해 확장될 수 있습니다.
`,
      caution:`【주의점 및 어려움】

- 특정 기질이 높거나 낮을 때 스트레스 상황에서 반복되는 반응이 나타날 수 있습니다.
- 정서적 예민함, 회피, 충동성, 관계 피로감 등이 개인에 따라 다르게 나타날 수 있습니다.
`,
      plan:`【상담 제안】

1. 기질을 바꾸려 하기보다 이해하고 조율하기
2. 스트레스 상황에서 자동으로 나타나는 반응 알아차리기
3. 대인관계에서 반복되는 패턴 탐색하기
4. 생활 속 자기조절 전략 만들기
`
    },
    "STS": {
      summary:`【STS 6요인 기질검사 종합 소견】

1. 정서성:
2. 활동성:
3. 사회성:
4. 수줍음:
5. 주의집중:
6. 지속성:

기질은 좋고 나쁨이 아니라 환경과 만났을 때 어떻게 드러나는지를 이해하는 것이 중요합니다.
`,
      strength:`【강점】

- 타고난 기질을 이해하면 자신에게 맞는 환경과 대처 방식을 찾을 수 있습니다.
- 강점 기질은 학습, 관계, 일상 적응의 자원이 될 수 있습니다.
`,
      caution:`【주의점】

- 기질과 환경이 맞지 않을 때 피로감이나 갈등이 커질 수 있습니다.
- 특정 기질을 문제로 보기보다 조절과 환경 조율의 관점에서 이해해야 합니다.
`,
      plan:`【제안】

- 기질에 맞는 생활 리듬 만들기
- 정서 반응을 알아차리는 연습
- 관계 상황에서 무리하지 않는 자기표현 연습
`
    },
    "PAT": {
      summary:`【PAT 부모양육태도검사 종합 소견】

1. 양육태도 주요 프로파일
- 지지/수용:
- 자율성 존중:
- 일관성:
- 통제/지시:
- 과보호:
- 성취압력:
- 정서적 반응성:

2. 부모-자녀 관계에서 나타날 수 있는 모습
`,
      strength:`【양육 강점】

- 자녀를 이해하려는 관심과 참여가 중요한 강점입니다.
- 부모가 자신의 양육 방식을 점검하려는 태도는 관계 변화의 출발점이 됩니다.
- 일상 속 작은 반응 변화만으로도 자녀의 안정감과 협력 행동이 달라질 수 있습니다.
`,
      caution:`【주의점 및 조율이 필요한 부분】

- 부모의 기대 수준과 자녀의 발달 수준이 다를 경우 갈등이 커질 수 있습니다.
- 통제와 허용의 균형이 맞지 않으면 자녀가 혼란을 느낄 수 있습니다.
- 부모의 피로와 스트레스가 높을 때 일관된 양육 반응이 어려워질 수 있습니다.
`,
      plan:`【양육코칭 제안】

1. 아이의 행동을 ‘문제’보다 ‘신호’로 바라보기
2. 짧고 구체적인 지시 사용하기
3. 제한은 분명하게, 감정은 따뜻하게 반응하기
4. 긍정 행동을 즉시 알아차리고 강화하기
5. 부모의 감정 조절과 회복 시간을 함께 확보하기
`
    },
    "KCDI": {
      summary:`【KCDI 아동발달검사 종합 소견】

1. 발달 영역별 결과
- 사회성:
- 자조행동:
- 대근육:
- 소근육:
- 표현언어:
- 언어이해:
- 글자/숫자:
- 정서/행동:
- 전체 발달 수준:

2. 현재 아이에게 필요한 지원
`,
      strength:`【아이의 강점 및 자원】

- 아이가 잘하고 있는 영역을 먼저 확인하는 것이 중요합니다.
- 강점 영역은 부족한 영역을 돕는 발판이 될 수 있습니다.
- 발달은 속도의 차이가 있으므로 현재 수준에 맞춘 지원이 필요합니다.
`,
      caution:`【주의 깊게 볼 부분】

- 특정 발달 영역에서 지연 또는 어려움이 의심될 경우 지속적인 관찰이 필요합니다.
- 언어, 사회성, 정서조절, 일상생활 적응은 서로 연결되어 나타날 수 있습니다.
- 검사 결과만으로 단정하지 않고 실제 관찰과 부모 면담을 함께 고려해야 합니다.
`,
      plan:`【발달 지원 제안】

1. 아이의 현재 발달 수준에 맞춘 상호작용 제공
2. 짧고 반복적인 언어 자극 사용
3. 놀이 속에서 요구하기, 기다리기, 주고받기 연습
4. 성공 경험을 작게 나누어 제공하기
5. 가정과 기관이 같은 목표로 일관되게 지원하기
6. 필요 시 발달평가 또는 전문기관 상담 연계
`
    },
    "PAT · KCDI": {
      summary:`【PAT · KCDI 통합 종합 소견】

1. PAT 부모양육태도 요약
- 지지/수용:
- 자율성 존중:
- 일관성:
- 통제/지시:
- 과보호/성취압력:

2. KCDI 아동발달 요약
- 사회성:
- 자조행동:
- 대근육/소근육:
- 표현언어/언어이해:
- 정서/행동:

3. 부모-자녀 상호작용 가설
- 부모의 양육 반응과 자녀 발달 특성의 맞물림:
- 갈등 또는 어려움이 반복되는 장면:
- 자녀의 발달 신호를 부모가 해석하는 방식:
`,
      strength:`【가족의 강점 및 자원】

- 부모가 자녀를 이해하려는 관심과 참여가 중요한 자원입니다.
- 자녀의 발달 특성을 이해하면 양육 기대를 현실적으로 조율할 수 있습니다.
- 부모-자녀 관계는 작은 상호작용 변화만으로도 긍정적 변화가 나타날 수 있습니다.
`,
      caution:`【주의점 및 조율이 필요한 부분】

- 자녀의 발달 속도와 부모의 기대 수준이 다를 때 갈등이 커질 수 있습니다.
- 아이의 행동을 의도적 문제로만 해석하면 상호작용이 경직될 수 있습니다.
- 부모의 피로와 양육 스트레스도 함께 살펴볼 필요가 있습니다.
- 발달 특성은 양육태도와 상호작용하며 나타날 수 있습니다.
`,
      plan:`【통합 양육코칭 제안】

1. 아이의 발달 수준에 맞는 기대 설정
2. 부모의 지시를 짧고 구체적으로 조정
3. 긍정 행동 즉시 강화
4. 감정 이름 붙이기와 공감 반응 연습
5. 놀이 기반 상호작용 시간 확보
6. 가정과 기관의 일관된 지원 목표 설정
`
    },
    "MMPI-2": {
      summary:`【MMPI-2 종합 소견】

1. 타당도 척도
- L:
- F:
- K:
- VRIN/TRIN:

2. 임상척도
- Hs:
- D:
- Hy:
- Pd:
- Mf:
- Pa:
- Pt:
- Sc:
- Ma:
- Si:

3. 코드타입 및 임상적 가설
`,
      strength:`【강점 및 보호요인】

- 자신의 어려움을 점검하고 도움을 요청하려는 시도 자체가 중요한 보호요인입니다.
- 검사 결과를 통해 막연한 어려움을 구체화할 수 있습니다.
`,
      caution:`【주의점】

- 높은 척도가 있다면 현재 심리적 부담이 크다는 신호일 수 있습니다.
- 위기 신호, 우울, 불안, 충동성, 현실검증력 관련 내용은 면담으로 추가 확인이 필요합니다.
`,
      plan:`【상담 제안】

1. 주호소와 검사 결과의 일치 여부 확인
2. 정서 안정화 및 위기 신호 점검
3. 반복되는 사고·감정·행동 패턴 탐색
4. 필요 시 정신건강의학과 또는 전문기관 연계
`
    },
    "SCT": {
      summary:`【SCT 문장완성검사 종합 소견】

1. 자기이해 영역:
2. 가족 및 관계 영역:
3. 정서 표현:
4. 미래 기대 및 욕구:
`,
      strength:`【강점】

- 문장 속에 드러난 욕구와 자원을 확인할 수 있습니다.
- 말로 표현하기 어려운 감정이 간접적으로 드러날 수 있습니다.
`,
      caution:`【주의점】

- 반복적으로 나타나는 부정적 자기평가, 불안, 분노, 회피 표현은 상담에서 추가 탐색이 필요합니다.
`,
      plan:`【상담 제안】

- 핵심 문장 함께 살펴보기
- 반복되는 관계 주제 탐색
- 미표현 감정 언어화
- 자기이해와 자기수용 작업
`
    },
    "HTP": {
      summary:`【HTP 그림검사 종합 소견】

1. 집 그림: 환경과 안정감
2. 나무 그림: 자기 에너지와 성장감
3. 사람 그림: 자기상과 관계 표현
`,
      strength:`【강점】

- 언어로 표현하기 어려운 정서와 경험을 그림을 통해 탐색할 수 있습니다.
- 그림 해석은 면담과 함께 통합적으로 이해할 때 의미가 커집니다.
`,
      caution:`【주의점】

- 그림만으로 단정적 해석을 하지 않습니다.
- 크기, 압력, 생략, 위치 등은 면담 내용과 함께 확인해야 합니다.
`,
      plan:`【상담 제안】

- 그림에 담긴 느낌과 이야기 나누기
- 안전감, 자기상, 관계 경험 탐색
- 필요 시 SCT 또는 MMPI 등 추가검사와 통합
`
    },
    "통합": {
      summary:`【통합 심리검사 종합 소견】

1. 현재 주호소
2. 정서 및 스트레스 반응
3. 성격 및 기질 특성
4. 양육/관계 패턴
5. 상담에서 우선적으로 다룰 주제
`,
      strength:`【강점 및 자원】

- 자기이해를 위한 동기
- 변화 가능성
- 관계적 자원
- 회복을 돕는 생활 자원
`,
      caution:`【주의점】

- 반복되는 정서적 어려움
- 대인관계 갈등 패턴
- 회피 또는 과잉노력
- 위기 신호 여부
`,
      plan:`【상담 계획】

1. 초기 안정화
2. 핵심 패턴 이해
3. 검사 해석상담
4. 일상 실천과제
5. 사후관리 및 재평가
`
    }
  };
  return common[testType] || common["통합"];
}
function applyDetailedTemplate(){
  const t=modumamReportTemplate(state.reportForm.testType||"통합");
  state.reportForm.summary=t.summary||"";
  state.reportForm.strength=t.strength||"";
  state.reportForm.caution=t.caution||"";
  state.reportForm.plan=t.plan||"";
  render();
}

function saveCurrentReportEdit(approveAfterSave=false,silent=false){
  const id=state.reportEditingId;
  const old=(state.reports||[]).find(r=>String(r.id)===String(id));
  if(!old){alert('수정할 보고서를 찾지 못했습니다.');return false;}
  const now=new Date().toLocaleString('ko-KR');
  const history=Array.isArray(old.versionHistory)?old.versionHistory:[];
  const snapshot={version:Number(old.version||1),savedAt:old.updatedAt||old.createdAt||now,summary:old.summary||'',strength:old.strength||'',caution:old.caution||'',plan:old.plan||'',title:old.title||''};
  const next={...old,...state.reportForm,reportType:'summaryReport',summaryReport:true,selectedTests:sanitizeReportTests(state.reportForm.selectedTests),testType:sanitizeReportTests(state.reportForm.selectedTests).join(', '),strength:state.reportForm.mindProfile||state.reportForm.strength||'',caution:state.reportForm.emotionState||state.reportForm.caution||'',coreMind:state.reportForm.summary||'',expertRecovery:state.reportForm.plan||'',version:Number(old.version||1)+1,updatedAt:now,versionHistory:[snapshot,...history].slice(0,10),approvedForClient:false,status:'승인 대기'};
  state.reports=(state.reports||[]).map(r=>String(r.id)===String(id)?next:r);
  persistReports(state.reports);
  if(next.reservationId){
    state.reservations=(state.reservations||[]).map(r=>String(r.id)===String(next.reservationId)?{...r,assessmentReportStatus:'관리자 검토 중',assessmentReportPublishedAt:'',assessmentReportApprovedAt:''}:r);
    save('modumam_reservations',state.reservations);
  }
  state.reportForm={...state.reportForm};
  if(!silent&&!approveAfterSave)alert('심리검사 요약보고서가 저장되었습니다. 정식 종합보고서는 심리평가센터에서 별도로 생성·승인합니다.');
  if(approveAfterSave){toggleReportApproval(id);return true;}
  render();
  return true;
}
function saveAndPrintCurrentReport(){
  const id=state.reportEditingId;
  if(!id)return;
  if(saveCurrentReportEdit(false,true))setTimeout(()=>printReport(id),50);
}
window.saveCurrentReportEdit=saveCurrentReportEdit;
window.saveAndPrintCurrentReport=saveAndPrintCurrentReport;

function toggleReportTest(test,checked){if(!REPORT_TEST_OPTIONS.includes(test))return;const list=sanitizeReportTests(state.reportForm.selectedTests);state.reportForm.selectedTests=checked?[...new Set([...list,test])]:list.filter(x=>x!==test);state.reportForm.testType=state.reportForm.selectedTests.join(', ');render()}
window.toggleReportTest=toggleReportTest;

function canonicalReportType(report){
  if(!report)return 'unknown';
  if(report.individualAssessmentReport||report.reportType==='individualReport')return 'individualReport';
  if(report.integratedAssessmentReport||report.reportType==='counselorComprehensiveReport')return 'counselorComprehensiveReport';
  if(report.assessmentReport||report.comprehensiveReport||report.reportType==='comprehensiveReport')return 'comprehensiveReport';
  if(report.summaryReport||report.reportType==='summaryReport'||report.reportType==='관리자용'||report.reportType==='general')return 'removedSummaryReport';
  return String(report.reportType||'unknown');
}
function reportTypeLabel(report){
  return ({individualReport:'개별 심리검사 보고서',comprehensiveReport:'심리검사 종합보고서',counselorComprehensiveReport:'AI 종합해석보고서'})[canonicalReportType(report)]||'기타 보고서';
}
function openComprehensiveReportCenter(reservationId){
  const id=reservationId||state.reportForm?.reservationId||state.reportEditingId&&((state.reports||[]).find(r=>String(r.id)===String(state.reportEditingId))||{}).reservationId||'';
  state.assessmentReservationId=id||state.assessmentReservationId||'';
  state.menu='interpretation';
  render();
  setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),0);
}
window.canonicalReportType=canonicalReportType;
window.reportTypeLabel=reportTypeLabel;
window.openComprehensiveReportCenter=openComprehensiveReportCenter;

function reportEditViewExact(){
  state.menu='interpretation';
  return typeof testInterpretationView==='function'?testInterpretationView():'';
}

function reportView(){
  state.menu='interpretation';
  return typeof testInterpretationView==='function'?testInterpretationView():'';
}
function closeAssessmentReportEditor(){
  const modal=document.getElementById('assessment-report-editor-modal');
  if(modal)modal.remove();
  if(document?.body)document.body.style.overflow='';
}

function openAssessmentReportEditor(reportId){
  const report=(state.reports||[]).find(r=>String(r.id)===String(reportId));
  if(!report){alert('수정할 종합 보고서를 찾지 못했습니다.');return;}
  closeAssessmentReportEditor();
  const sec=report.sections||{};
  const fields=[
    ['title','보고서 제목',2,report.title||'종합 보고서'],
    ['keyMessage','종합 요약',5,sec.keyMessage||''],
    ['emotionalProfile','정서적 특성',5,sec.emotionalProfile||''],
    ['thinkingStyle','사고와 의사결정 특성',5,sec.thinkingStyle||''],
    ['relationshipStyle','대인관계와 의사소통 특성',5,sec.relationshipStyle||''],
    ['stressRecovery','스트레스 반응과 회복',5,sec.stressRecovery||''],
    ['strengthsResources','강점과 심리적 자원',5,sec.strengthsResources||''],
    ['integratedUnderstanding','통합적 이해',6,sec.integratedUnderstanding||''],
    ['currentSignals','현재 살펴볼 신호',5,sec.currentSignals||''],
    ['psychologicalSuggestions','심리검사 기반 제안',6,sec.psychologicalSuggestions||''],
    ['professionalSummary','전문가 종합 소견',5,sec.professionalSummary||''],
    ['disclaimer','검사 해석의 범위와 한계',4,sec.disclaimer||'']
  ];
  const modal=document.createElement('div');
  modal.id='assessment-report-editor-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.72);padding:18px;overflow:auto';
  modal.innerHTML=`<div style="max-width:980px;margin:0 auto;background:white;border-radius:24px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.3)"><div style="position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 22px;background:#fff;border-bottom:1px solid #e2e8f0"><div><b style="font-size:18px;color:#0f172a">종합 보고서 수정</b><p style="margin:5px 0 0;font-size:12px;color:#64748b">저장하면 내담자 공개가 자동 해제됩니다. 내용 확인 후 다시 공개하세요.</p></div><button id="assessment-editor-close" style="border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font-weight:800;cursor:pointer">닫기</button></div><div style="padding:22px;display:grid;gap:16px">${fields.map(([key,label,rows,value])=>`<label style="display:block;font-size:12px;font-weight:800;color:#475569">${label}<textarea id="assessment-edit-${key}" rows="${rows}" style="margin-top:7px;width:100%;border:1px solid #cbd5e1;border-radius:14px;padding:13px;font:inherit;line-height:1.65;resize:vertical">${esc(value)}</textarea></label>`).join('')}<button id="assessment-editor-save" style="border:0;border-radius:14px;background:#0f172a;color:#fff;padding:15px;font-weight:900;cursor:pointer">수정 내용 저장</button></div></div>`;
  document.body.appendChild(modal);document.body.style.overflow='hidden';
  modal.querySelector('#assessment-editor-close').onclick=closeAssessmentReportEditor;
  modal.onclick=e=>{if(e.target===modal)closeAssessmentReportEditor();};
  modal.querySelector('#assessment-editor-save').onclick=()=>{
    const value=k=>document.getElementById(`assessment-edit-${k}`)?.value?.trim()||'';
    const now=new Date().toLocaleString('ko-KR');
    const nextSections={...sec,keyMessage:value('keyMessage'),emotionalProfile:value('emotionalProfile'),thinkingStyle:value('thinkingStyle'),relationshipStyle:value('relationshipStyle'),stressRecovery:value('stressRecovery'),strengthsResources:value('strengthsResources'),integratedUnderstanding:value('integratedUnderstanding'),currentSignals:value('currentSignals'),psychologicalSuggestions:value('psychologicalSuggestions'),professionalSummary:value('professionalSummary'),disclaimer:value('disclaimer')};
    state.reports=(state.reports||[]).map(r=>String(r.id)===String(reportId)?{...r,title:value('title')||r.title,sections:nextSections,summary:[nextSections.keyMessage,nextSections.integratedUnderstanding].filter(Boolean).join('\n\n'),strength:nextSections.strengthsResources,caution:nextSections.currentSignals,plan:[nextSections.psychologicalSuggestions,nextSections.disclaimer].filter(Boolean).join('\n\n'),approvedForClient:false,status:'수정 완료 · 공개 대기',reviewStatus:'edited',updatedAt:now}:r);
    persistReports(state.reports);
    closeAssessmentReportEditor();
    alert('종합 보고서를 수정 저장했습니다. 내담자 공개는 해제되었습니다.');
    render();
  };
}
function toggleAssessmentReportPublication(reportId){
  const report=(state.reports||[]).find(r=>String(r.id)===String(reportId));
  if(!report){alert('종합 보고서를 찾지 못했습니다.');return;}
  const next=!report.approvedForClient;
  if(!confirm(next?'수정 내용을 확인했습니다. 이 종합 보고서를 내담자에게 공개할까요?':'내담자 공개를 취소할까요?'))return;
  const now=new Date().toLocaleString('ko-KR');
  state.reports=(state.reports||[]).map(r=>{
    const sameReport=String(r.id)===String(reportId);
    const linkedIndividual=report.assessmentReport&&r.individualAssessmentReport&&String(r.reservationId)===String(report.reservationId);
    if(!sameReport&&!linkedIndividual)return r;
    return {...r,approvedForClient:next,publishedAt:next?now:'',status:next?'내담자 공개':'상담자 승인 완료 · 공개 전',updatedAt:now};
  });
  persistReports(state.reports);
  const reservationId=report.reservationId;
  if(reservationId)updateReservation(reservationId,{assessmentReportPublishedAt:next?now:'',assessmentReportStatus:next?'내담자 공개':'상담자 승인 완료'});
  else render();
}
window.openAssessmentReportEditor=openAssessmentReportEditor;
window.closeAssessmentReportEditor=closeAssessmentReportEditor;
window.toggleAssessmentReportPublication=toggleAssessmentReportPublication;

function openAssessmentCenterForReport(reportId){
  const report=(state.reports||[]).find(r=>String(r.id)===String(reportId));
  if(!report){alert('보고서를 찾지 못했습니다.');return;}
  const reservationId=report.reservationId||report.bookingId||report.sourceReservationId;
  if(reservationId){
    state.assessmentReservationId=String(reservationId);
  }else{
    const match=(state.reservations||[]).find(r=>
      String(r.name||'').trim()===String(report.clientName||report.name||'').trim() &&
      (!report.program || programBaseName(r.program)===programBaseName(report.program))
    );
    if(match) state.assessmentReservationId=String(match.id);
  }
  state.menu='interpretation';
  render();
}

/* =========================================================
   [MOD-20260720-SIGNATURE-DERIVED-REPORTS-V4]
   모두의 마음연구소 시그니처 폼 적용 + 내담자/상담자 카드 분리
========================================================= */

/* =========================================================
   [MOD-20260720-ECHART-DERIVED-REPORTS]
   심리평가센터의 통합보고서를 원본으로 전자차트에서
   내담자용·상담자용 종합보고서를 새로 생성하고 항목별 수정·저장합니다.
   원본 통합보고서는 변경하지 않습니다.
========================================================= */
// [MML-20260725] 이전 파생 보고서 API는 호환용으로만 유지합니다.
// 실제 원본은 MMLCanonicalReportStore(modumam_reports) 하나만 사용합니다.
function derivedAssessmentReports(){
  try{
    const rows=window.MMLCanonicalReportStore?.read?.()||[];
    return rows.filter(row=>row&&(
      row.integratedAssessmentReport===true||
      row.assessmentReport===true||
      row.derivedReportType||
      row.audience==='client'||
      row.audience==='counselor'
    ));
  }catch(e){return[]}
}
function saveDerivedAssessmentReports(rows){
  try{
    const store=window.MMLCanonicalReportStore;
    if(!store?.read||!store?.write)return [];
    const incoming=Array.isArray(rows)?rows:[];
    const incomingIds=new Set(incoming.map(row=>String(row?.id||'')).filter(Boolean));
    const keep=store.read().filter(row=>!incomingIds.has(String(row?.id||'')));
    return store.write([...incoming,...keep],{action:'보고서 저장소 호환 저장'});
  }catch(e){console.warn('[MML] canonical report compatibility save failed',e);return[]}
}
function integratedReportById(id){
  return (state.reports||[]).find(r=>String(r.id)===String(id)) ||
    (window.MMLClinicalAssessmentStore?.allRecords?.()||[]).flatMap(x=>x.issuedReports||[]).find(r=>String(r.id)===String(id)) || null;
}
function cleanReportText(value){return String(value||'').trim()}
function firstReportText(...values){return values.map(cleanReportText).find(Boolean)||''}
function uniqueReportTexts(values){
  const seen=new Set();
  const rows=[];
  for(const value of values.flat(Infinity)){
    const text=cleanReportText(value);
    if(!text)continue;
    const key=text.replace(/\s+/g,' ').toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);
    rows.push(text);
  }
  return rows;
}
function labeledReportEvidence(label,values){
  const rows=uniqueReportTexts(values);
  if(!rows.length)return '';
  return `${label}\n${rows.map((text,index)=>`${index+1}) ${text}`).join('\n')}`;
}
function buildClientReportEvidencePackage(source){
  const master=source.masterReport||{};
  const profile=source.clinicalProfile||master.clinicalProfile||{};
  const generated=master.reportGenerationData||{};
  const shared=generated.shared||{};
  const counselor=generated.counselor||{};
  const client=generated.client||{};
  const sections=source.sections||{};
  const inventory=Array.isArray(master.sourceInventory)?master.sourceInventory:[];
  const testEvidence=inventory.map((row,index)=>({
    order:index+1,
    testType:cleanReportText(row.testType||row.testName),
    subjectRole:cleanReportText(row.subjectRole),
    coreFindings:cleanReportText(row.coreFindings||row.sourceSummary),
    validity:cleanReportText(row.validity),
    strengths:cleanReportText(row.strengths),
    vulnerabilities:cleanReportText(row.vulnerabilities),
    cautions:cleanReportText(row.cautions)
  })).filter(row=>Object.values(row).some(Boolean));
  return {
    reportTitle:firstReportText(source.title,shared.title,'심리검사 종합보고서'),
    evaluationOverview:labeledReportEvidence('평가 개요',[shared.evaluationOverview,sections.evaluationOverview,source.evaluationOverview]),
    testGuide:labeledReportEvidence('실시검사와 검사별 역할',[shared.testGuide,sections.testGuide,source.testGuide]),
    currentState:labeledReportEvidence('현재 정서 및 심리상태',[profile.currentState,shared.clinicalCurrentState,client.currentMind,sections.emotionalProfile,sections.currentSignals]),
    stableTraits:labeledReportEvidence('기질·성격 및 비교적 안정적인 특성',[profile.stableTraits,shared.clinicalTrait,client.temperamentCharacter,sections.thinkingStyle]),
    relationshipPattern:labeledReportEvidence('사고 및 대인관계 방식',[client.thinkingRelationship,sections.relationshipStyle,sections.thinkingStyle]),
    commonPatterns:labeledReportEvidence('여러 검사에서 공통으로 확인된 특징',[shared.clinicalConvergence,client.commonPatterns,sections.integratedUnderstanding]),
    differences:labeledReportEvidence('검사 간 차이 또는 함께 설명해야 할 부분',[shared.clinicalDivergence,client.differences]),
    formulation:labeledReportEvidence('스트레스 반응과 일상 기능의 흐름',[shared.clinicalFormulation,client.functionalFormulation,counselor.caseFormulation5P,sections.stressRecovery]),
    strengths:labeledReportEvidence('강점과 보호요인',[profile.strengths,shared.clinicalProtectiveFactors,client.strengthGuide,sections.strengthsResources]),
    vulnerabilities:labeledReportEvidence('부담·취약·주의 요인',[profile.vulnerabilities,shared.clinicalVulnerabilities,client.cautionGuide,sections.currentSignals]),
    evidenceSummary:labeledReportEvidence('검사별 핵심 근거',[counselor.evidenceSummary,client.testFindings,sections.testGuide]),
    professionalSummary:labeledReportEvidence('전문가 종합 의견',[counselor.professionalSummary,client.professionalSummary,sections.professionalSummary]),
    sourceInventory:testEvidence,
    authoringRequirements:{
      purpose:'저장된 AI 종합해석보고서를 단순 축약하지 말고 내담자용 심리검사 종합보고서로 새로 작성',
      sectionRoles:{
        clientCoreMind:'여러 검사에서 가장 중요한 핵심 2~3가지와 현재 부담·강점의 균형',
        clientMindProfile:'기질·성격, 현재 상태, 자기조절, 관계 및 회복자원을 하나의 흐름으로 통합',
        clientIndividualTests:'검사별로 핵심 결과 → 일상에서의 의미 → 전체 해석에서의 역할',
        clientEmotionState:'정서의 수준뿐 아니라 촉발 조건, 표현·조절 방식, 생활 영향',
        clientThinkingRelationship:'사고 경향과 관계 방식의 장점, 갈등 시 어려움, 균형점',
        clientStressDaily:'스트레스 상황 → 내적 반응 → 행동·일상 기능 → 회복자원',
        clientExpertRecovery:'앞선 결과와 직접 연결된 3~5개 제언. 각 제언은 이유와 실제 적용 방법 포함'
      },
      rules:[
        '검사명을 나열한 뒤 같은 결론을 반복하지 않는다.',
        '각 영역은 다른 역할을 가지며 동일 문장을 재사용하지 않는다.',
        '근거가 없는 추정, 진단 확정, 과장된 표현을 금지한다.',
        '쉬운 언어를 사용하되 심리평가 보고서의 전문성을 유지한다.',
        '짧은 결론만 쓰지 말고 근거와 생활 속 의미를 함께 설명한다.'
      ]
    }
  };
}


function buildNormalizedClinicalEvidence(evidence){
  return window.MMLClinicalEngine.buildNormalizedClinicalEvidence(evidence);
}

function buildClinicalSynthesisBlueprint(evidence){
  const inventory=Array.isArray(evidence?.sourceInventory)?evidence.sourceInventory:[];
  const rows=inventory.map((row,index)=>({
    test:index+1,
    testType:cleanReportText(row.testType),
    supports:uniqueReportTexts([row.coreFindings,row.strengths]),
    cautions:uniqueReportTexts([row.vulnerabilities,row.cautions]),
    validity:cleanReportText(row.validity)
  })).filter(row=>row.testType||row.supports.length||row.cautions.length);
  return {
    reasoningOrder:[
      '1. 검사별 핵심 근거와 해석 제한을 먼저 구분한다.',
      '2. 두 개 이상 검사에서 함께 확인되는 특징을 공통 패턴으로 묶는다.',
      '3. 서로 다르게 보이는 결과는 모순으로 단정하지 말고 상황·특성·현재 상태의 차이로 설명한다.',
      '4. 현재 부담, 비교적 안정적인 성격 특성, 강점과 보호요인을 분리한다.',
      '5. 최종 보고서는 검사 순서가 아니라 내담자의 심리적 흐름을 중심으로 작성한다.'
    ],
    evidenceMatrix:rows,
    interpretationHierarchy:{
      primary:'현재 기능과 생활에 가장 직접적인 영향을 주는 핵심 특징 2~3개',
      secondary:'핵심 특징을 강화하거나 완충하는 성격·관계·대처 특성',
      protective:'회복에 활용할 수 있는 강점과 자원',
      caution:'추가 확인이 필요하거나 해석을 제한해야 하는 부분'
    },
    conflictRules:[
      '특성검사와 상태검사의 차이를 구분한다.',
      '자기보고 검사 간 차이는 상황, 방어, 인식 수준의 가능성을 함께 고려하되 근거 없이 추정하지 않는다.',
      '한 검사만 지지하는 내용은 전체 성격으로 일반화하지 않는다.'
    ],
    writingFrame:'근거 → 심리적 의미 → 일상에서 나타날 수 있는 모습 → 강점 또는 주의점의 순서로 연결한다.'
  };
}



function buildClinicalReasoningEngine(evidence){
  return window.MMLClinicalEngine.buildClinicalReasoningEngine(evidence);
}

function buildClinicalDecisionTrace(evidence){
  return window.MMLClinicalEngine.buildClinicalDecisionTrace(evidence);
}

function buildClientReportSelfReview(report,evidence){
  const qualityIssues=clientReportQualityIssues(report);
  const clinicalIssues=clientReportClinicalIssues(report,evidence);
  const issues=[...new Set([...qualityIssues,...clinicalIssues])];
  const sections=['clientCoreMind','clientMindProfile','clientIndividualTests','clientEmotionState','clientThinkingRelationship','clientStressDaily','clientExpertRecovery'];
  const completed=sections.filter(key=>cleanReportText(report?.[key]).length>=120).length;
  return {
    schemaVersion:'mml-client-report-self-review-v1',
    reviewedAt:new Date().toISOString(),
    passed:issues.length===0,
    score:Math.max(0,100-issues.length*10-(sections.length-completed)*5),
    completedSections:completed,
    totalSections:sections.length,
    issues,
    checks:[
      '근거 없는 단정 여부',
      '검사 간 공통점과 차이 설명 여부',
      '안정적 특성과 최근 상태 구분 여부',
      '영역 간 반복 여부',
      '생활 속 의미 연결 여부',
      '전문가 제언과 사례개념화 연결 여부'
    ]
  };
}

function buildClinicalEvidenceConfidence(evidence){
  return window.MMLClinicalEngine.buildClinicalEvidenceConfidence(evidence);
}

function buildClinicalConflictMap(evidence){
  return window.MMLClinicalEngine.buildClinicalConflictMap(evidence);
}

function buildClientCaseConceptualizationObject(evidence){
  return window.MMLClinicalEngine.buildClientCaseConceptualizationObject(evidence);
}

function clientReportClinicalIssues(report,evidence){
  const issues=[];
  const sections=['clientCoreMind','clientMindProfile','clientIndividualTests','clientEmotionState','clientThinkingRelationship','clientStressDaily','clientExpertRecovery'];
  const texts=sections.map(key=>cleanReportText(report?.[key]));
  const joined=texts.join(' ');
  const inventory=Array.isArray(evidence?.sourceInventory)?evidence.sourceInventory:[];
  const testNames=inventory.map(x=>cleanReportText(x.testType)).filter(Boolean);
  if(testNames.length>1&&testNames.filter(name=>joined.includes(name)).length===0)issues.push('여러 검사 근거가 사용되었는지 확인하기 어려움');
  if(!/(공통|함께|일관|여러 검사|종합)/.test(joined))issues.push('검사 간 공통점에 대한 통합 설명이 부족함');
  if(cleanReportText(evidence?.differences)&&!/(차이|다르게|한편|반면|상황에 따라)/.test(joined))issues.push('검사 간 차이 또는 함께 설명할 부분이 반영되지 않음');
  if(!/(강점|자원|보호|도움이 되는)/.test(joined))issues.push('강점 또는 보호요인 설명이 부족함');
  if(!/(일상|생활|관계|상황|스트레스)/.test(joined))issues.push('검사 결과와 생활 속 의미의 연결이 부족함');
  if(!/(최근|현재|평소|기질|성격|상황에 따라)/.test(joined))issues.push('비교적 안정적인 특성과 현재 상태의 구분이 부족함');
  if(!/(영향|이어지|지속|완충|보호|회복)/.test(joined))issues.push('스트레스 반응, 유지요인, 보호요인의 흐름이 부족함');
  const recovery=cleanReportText(report?.clientExpertRecovery);
  if(recovery&&!/(1[.)]|①|첫째|우선|구체|실천|방법)/.test(recovery))issues.push('전문가 제언에 구체적인 실행 방법이 부족함');
  return [...new Set(issues)];
}

function clientReportQualityIssues(report){
  const fields=[
    ['clientCoreMind','현재 마음의 핵심 모습',220],
    ['clientMindProfile','마음 프로파일',360],
    ['clientIndividualTests','개별검사 요약',360],
    ['clientEmotionState','정서와 심리상태',260],
    ['clientThinkingRelationship','사고와 관계 방식',260],
    ['clientStressDaily','스트레스와 일상생활',260],
    ['clientExpertRecovery','전문가 제언 및 회복 방향',320]
  ];
  const issues=[];
  for(const [key,label,min] of fields){
    const text=cleanReportText(report?.[key]);
    if(text.length<min)issues.push(`${label}이 너무 짧음(${text.length}자, 권장 ${min}자 이상)`);
    if(/interpretationBasis|coreFindings|resultSummary|sourceInventory/i.test(text))issues.push(`${label}에 내부 필드명이 노출됨`);
  }
  const normalized=fields.map(([key])=>cleanReportText(report?.[key]).replace(/\s+/g,' ')).filter(Boolean);
  for(let i=0;i<normalized.length;i++)for(let j=i+1;j<normalized.length;j++){
    const a=new Set(normalized[i].split(/\s+/).filter(v=>v.length>1));
    const b=new Set(normalized[j].split(/\s+/).filter(v=>v.length>1));
    if(!a.size||!b.size)continue;
    const overlap=[...a].filter(v=>b.has(v)).length/Math.min(a.size,b.size);
    if(overlap>.72)issues.push('영역 간 내용이 지나치게 유사함');
  }
  return [...new Set(issues)];
}
function buildDerivedAssessmentSections(source,audience){
  const m=source.masterReport||source.clinicalProfile||{};
  const s=source.sections||{};
  if(audience==='counselor'){
    return [
      ['evaluationPurpose','1. 평가 목적',firstReportText(m.evaluationOverview,s.evaluationOverview,source.evaluationOverview,'심리평가센터에서 확정한 통합보고서를 근거로 현재의 심리상태와 상담 시 고려사항을 종합하였습니다.')],
      ['validity','2. 검사자료와 해석 가능성',firstReportText(m.clinicalValidity,m.validity,s.clinicalValidity,'검사별 타당도와 해석 제한은 원자료 및 검사별 분석 내용을 함께 확인해야 합니다.')],
      ['testFindings','3. 검사별 주요 결과와 임상적 의미',firstReportText(m.evidenceSummary,m.clientTestFindings,s.testGuide,source.testGuide)],
      ['integration','4. 검사 간 일치점과 차이점',firstReportText(m.clinicalConvergence,m.clientCommonPatterns,s.integratedUnderstanding,m.clinicalDivergence,m.clientDifferences)],
      ['clinicalProfile','5. 정서·성격·대인관계·대처 특성',firstReportText(m.clinicalCurrentState,m.currentState,s.emotionalProfile,m.clinicalTrait,m.stableTraits,s.relationshipStyle,s.stressRecovery)],
      ['formulation','6. 취약요인·유지요인·보호요인',firstReportText(m.counselorCaseFormulation5P,m.clinicalFormulation,m.formulation,s.strengthsResources)],
      ['hypotheses','7. 임상적 가설과 추가 확인사항',firstReportText(m.counselorCoreUnderstanding,m.counselorInitialQuestions,m.riskAndLimits,s.currentSignals)],
      ['counseling','8. 상담 시 고려사항',firstReportText(m.counselorCounselingFocus,m.counselorInterventionGuide,m.counselorMonitoringPoints,s.psychologicalSuggestions)],
      ['professionalSummary','9. 상담자의 종합 의견',firstReportText(m.professionalSummary,s.professionalSummary,source.summary)]
    ];
  }
  return [
    ['coreMind','현재 마음의 핵심 모습',firstReportText(m.clientCoreMind,m.clientSelfUnderstanding,s.keyMessage,source.summary)],
    ['mindProfile','마음 프로파일',firstReportText(m.clientMindProfile,m.clientTemperamentCharacter,m.clientCommonPatterns,s.emotionalProfile,s.relationshipStyle,s.strengthsResources)],
    ['individualTests','개별검사 요약',firstReportText(m.clientTestFindings,m.evidenceSummary,s.testGuide,source.testGuide)],
    ['emotionState','정서와 심리상태',firstReportText(m.clientEmotionState,m.clientCurrentMind,m.clinicalCurrentState,s.emotionalProfile)],
    ['thinkingRelationship','사고와 관계 방식',firstReportText(m.clientThinkingRelationship,m.clientTemperamentCharacter,m.clientDifferences,s.relationshipStyle)],
    ['stressDaily','스트레스와 일상생활',firstReportText(m.clientStressDaily,m.clientFunctionalFormulation,s.stressRecovery)],
    ['expertRecovery','전문가 제언 및 회복 방향',firstReportText(m.clientExpertRecovery,m.clientRecoveryGuide,m.clientStrengthGuide,m.clientProfessionalSummary,s.psychologicalSuggestions,s.professionalSummary)],
    ['disclaimer','보고서 안내',firstReportText(m.clientDisclaimer,s.disclaimer,'이 보고서는 심리검사 결과를 바탕으로 현재의 상태와 경향을 이해하기 위한 참고자료이며, 검사 결과만으로 진단을 확정하지 않습니다.')]
  ];
}
async function generateDerivedAssessmentReport(sourceId,audience,buttonEl){
  const source=integratedReportById(sourceId);
  if(!source){alert('심리평가센터의 AI 종합해석보고서를 찾지 못했습니다. 먼저 AI 해석보고서를 저장해 주세요.');return;}
  const rows=derivedAssessmentReports();
  const old=rows.find(x=>String(x.sourceIntegratedReportId)===String(sourceId)&&x.audience===audience);

  // BUILD 20260723-CLIENT-REPORT-COMPOSER-V4.0-RENDER-FIX
  // 생성 버튼은 기존 저장본 열기가 아니라 항상 현재 AI 종합해석보고서로 새 초안을 작성합니다.
  // 기존 보고서는 아래 item.previousVersion에 보관합니다.

  const originalText=buttonEl?.textContent||'';
  if(buttonEl){buttonEl.disabled=true;buttonEl.textContent='새로 작성 중...';buttonEl.classList.add('opacity-60','cursor-wait');}
  try{
    let rewritten=null;
    if(audience==='client'){
      const sourcePayload=buildClientReportEvidencePackage(source);
      sourcePayload.normalizedEvidence=buildNormalizedClinicalEvidence(sourcePayload);
      sourcePayload.clinicalSynthesisBlueprint=buildClinicalSynthesisBlueprint(sourcePayload);
      sourcePayload.caseConceptualization=buildClientCaseConceptualizationObject(sourcePayload);
      sourcePayload.evidenceConfidence=buildClinicalEvidenceConfidence(sourcePayload);
      sourcePayload.conflictMap=buildClinicalConflictMap(sourcePayload);
      sourcePayload.clinicalReasoning=buildClinicalReasoningEngine(sourcePayload);
      sourcePayload.decisionTrace=buildClinicalDecisionTrace(sourcePayload);
      const requestBody={mode:'rewrite-client-from-integrated',clientName:source.clientName||source.name||'내담자',program:source.program||'',testNames:Array.isArray(source.tests)?source.tests.join(', '):String(source.tests||''),integratedReport:sourcePayload};
      const requestRewrite=async(body)=>{
        const response=await fetch('/.netlify/functions/mml-master-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data.report)throw new Error(data.error||'AI 종합해석보고서 기반 종합보고서 재작성에 실패했습니다.');
        return data.report;
      };
      rewritten=await requestRewrite(requestBody);
      const qualityIssues=[...clientReportQualityIssues(rewritten),...clientReportClinicalIssues(rewritten,sourcePayload)];
      if(qualityIssues.length){
        rewritten=await requestRewrite({...requestBody,integratedReport:{...sourcePayload,revisionFeedback:{issues:[...new Set(qualityIssues)],instruction:'아래 품질 문제를 모두 수정하여 보고서 전체를 다시 작성하세요. caseConceptualization을 중심으로 현재 어려움, 안정적인 성격 특성, 최근 상태 변화, 스트레스 반응과 유지요인, 보호요인, 회복 우선순위를 하나의 흐름으로 정리하세요. evidenceConfidence의 신뢰도에 맞춰 표현 강도를 조절하고, conflictMap에 나타난 차이는 평소 특성·최근 상태·상황별 반응의 관계로 설명하세요. 검사별 문장을 이어 붙이지 말고 각 결론을 근거, 심리적 의미, 생활 속 표현, 강점 또는 주의점과 연결하세요. clinicalReasoning의 hypotheses와 clinicalPriorities를 따라 핵심 가설의 근거 수준을 구분하고, decisionTrace의 confidence와 reasoning을 반영하여 우선순위가 높은 문제부터 서술하세요. 전문가 제언에는 이유와 실제 적용 방법을 포함하세요.'}}});
      }
    }
    const now=new Date().toISOString();
    const baseSections=buildDerivedAssessmentSections(source,audience);
    const rewrittenMap=rewritten?{
      coreMind:rewritten.clientCoreMind,mindProfile:rewritten.clientMindProfile,individualTests:rewritten.clientIndividualTests,emotionState:rewritten.clientEmotionState,thinkingRelationship:rewritten.clientThinkingRelationship,stressDaily:rewritten.clientStressDaily,expertRecovery:rewritten.clientExpertRecovery,disclaimer:rewritten.clientDisclaimer
    }:{};
    const item={
      id:old?.id||Date.now(),sourceIntegratedReportId:source.id,audience,
      title:audience==='counselor'?'상담자용 종합보고서':'심리검사 종합보고서',
      clientName:source.clientName||source.name||'',program:source.program||'',tests:source.tests||[],
      reservationId:String(source.reservationId||old?.reservationId||''),
      sections:baseSections.map(([key,label,text])=>({key,label,text:cleanReportText(rewrittenMap[key])||text})),
      status:'draft',approvedForClient:false,publishedAt:'',
      version:Number(old?.version||0)+1,sourceVersion:Number(source.version||1),createdAt:old?.createdAt||now,updatedAt:now,
      previousVersion:old?{sections:old.sections||[],status:old.status||'draft',approvedForClient:Boolean(old.approvedForClient),publishedAt:old.publishedAt||'',updatedAt:old.updatedAt||''}:null,
      normalizedEvidence:audience==='client'?buildNormalizedClinicalEvidence(buildClientReportEvidencePackage(source)):null,
      caseConceptualization:audience==='client'?buildClientCaseConceptualizationObject(buildClientReportEvidencePackage(source)):null,
      evidenceConfidence:audience==='client'?buildClinicalEvidenceConfidence(buildClientReportEvidencePackage(source)):null,
      conflictMap:audience==='client'?buildClinicalConflictMap(buildClientReportEvidencePackage(source)):null,
      clinicalReasoning:audience==='client'?buildClinicalReasoningEngine(buildClientReportEvidencePackage(source)):null,
      decisionTrace:audience==='client'?buildClinicalDecisionTrace(buildClientReportEvidencePackage(source)):null,
      selfReview:audience==='client'&&rewritten?buildClientReportSelfReview(rewritten,buildClientReportEvidencePackage(source)):null,
      rewritePromptVersion:audience==='client'?'mml-client-composer-v5.9-decision-trace':''
    };
    const next=rows.filter(x=>String(x.id)!==String(item.id));
    next.unshift(item);
    saveDerivedAssessmentReports(next);

    // 생성 직후 목록 화면으로 끝내지 않고 완성된 보고서를 바로 연다.
    // render()가 화면을 다시 그린 뒤 편집기 모달을 열어야 하므로 다음 프레임에서 실행한다.
    render();
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>openDerivedAssessmentReportForm(item.id));
    });
  }catch(error){
    const message=String(error?.message||'');
    const temporary=/일시적으로|혼잡|unavailable|timeout|시간이 초과|429|500|502|503|504/i.test(message);
    alert(temporary
      ?'AI 서버가 일시적으로 혼잡합니다. 기존에 저장된 보고서와 승인 상태는 변경되지 않았습니다. 잠시 후 다시 생성해 주세요.'
      :message||'종합보고서를 새로 작성하지 못했습니다.');
  }
  finally{if(buttonEl&&document.body.contains(buttonEl)){buttonEl.disabled=false;buttonEl.textContent=originalText;buttonEl.classList.remove('opacity-60','cursor-wait');}}
}
function derivedAssessmentReportById(id){return derivedAssessmentReports().find(x=>String(x.id)===String(id))||null}
const MML_TEST_REPORT_NAMES=[
  ['TCI','TCI 기질 및 성격검사'],
  ['MMPI-2','MMPI-2 다면적인성검사'],
  ['PAI','PAI 성격평가검사'],
  ['SCT','SCT 문장완성검사'],
  ['HTP','HTP 집·나무·사람 그림검사'],
  ['K-CDI','K-CDI 아동우울검사'],
  ['STS','STS 양육스트레스검사'],
  ['PAT','PAT 부모양육태도검사'],
  ['PHQ-9','PHQ-9 우울 선별검사'],
  ['GAD-7','GAD-7 불안 선별검사']
];
function formatIndividualTestReportText(value){
  let text=String(value||'').replace(/\r/g,' ').replace(/[ \t]+/g,' ').trim();
  if(!text)return '';
  // 기존 기호와 검사 제목을 정규화하여 각 검사 결과가 독립된 문단으로 시작되게 합니다.
  text=text.replace(/\s*[■◆▶]\s*/g,'\n\n■ ');
  for(const [code,title] of MML_TEST_REPORT_NAMES){
    const escaped=code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const full=title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const pattern=new RegExp(`(?:^|\\s|[,:;])(?:■\\s*)?(?:${full}|${escaped}(?:\\s*(?:기질\\s*및\\s*성격검사|다면적\\s*인성검사|다면적인성검사|성격평가검사|문장완성검사|집[·\\s]*나무[·\\s]*사람(?:\\s*그림검사)?|아동우울검사|양육스트레스검사|부모양육태도검사|우울\\s*선별검사|불안\\s*선별검사))?)(?:\\s*[:：-])?`,'gi');
    text=text.replace(pattern,`\n\n■ ${title}\n`);
  }
  return text.replace(/^[\s\n]+/,'').replace(/\n{3,}/g,'\n\n').trim();
}
function formatNumberedRecoveryText(value){
  let text=String(value||'').replace(/\r/g,'\n').replace(/[ \t]+/g,' ').trim();
  if(!text)return '';
  // 붙어 있는 번호 항목을 새 블록으로 분리하되, 번호만 홀로 남지 않게 합니다.
  text=text.replace(/(?:^|\s)(\d{1,2})\s*[.．)]\s*/g,(m,n)=>`\n\n${n}. `);
  return text.replace(/^[\s\n]+/,'').replace(/\n{3,}/g,'\n\n').trim();
}
function mmlSentenceParts(value){
  const text=String(value||'')
    .replace(/\r/g,'\n')
    .replace(/[ \t]+/g,' ')
    .replace(/\s*\n\s*/g,' ')
    .replace(/\s{2,}/g,' ')
    .trim();
  if(!text)return [];
  const matches=text.match(/[^.!?。！？]+[.!?。！？]+(?:["'”’)]*)|[^.!?。！？]+$/g);
  return (matches||[text]).map(v=>v.trim()).filter(Boolean);
}
function mmlComposeParagraphs(value,{target=170,max=300,maxSentences=3}={}){
  const raw=String(value||'').replace(/\r/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  if(!raw)return [];
  const units=raw.split(/\n\s*\n/).map(v=>v.replace(/\s*\n\s*/g,' ').replace(/\s{2,}/g,' ').trim()).filter(Boolean);
  const sentences=[];
  units.forEach(unit=>sentences.push(...mmlSentenceParts(unit)));
  const paragraphs=[];
  let current=[];
  let length=0;
  const flush=()=>{if(current.length){paragraphs.push(current.join(' ').replace(/\s{2,}/g,' ').trim());current=[];length=0;}};
  for(const sentence of sentences){
    const nextLength=length+(length?1:0)+sentence.length;
    if(current.length&&(current.length>=maxSentences||nextLength>max||(length>=target&&current.length>=2)))flush();
    current.push(sentence);length+=(length?1:0)+sentence.length;
  }
  flush();
  return paragraphs;
}
function mmlRepairBrokenPhrases(value){
  return String(value||'')
    .replace(/\r/g,'\n')
    // 따옴표 안이나 조사 앞에서 끊긴 임의 줄바꿈을 공백 하나로 복원합니다.
    .replace(/([가-힣A-Za-z0-9'"”’])\s*\n+\s*(?=[가-힣A-Za-z0-9'"“‘])/g,'$1 ')
    .replace(/[ \t]+/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}
function formatDerivedSectionText(section){
  const key=String(section?.key||'');
  if(key==='individualTests'||key==='testFindings')return formatIndividualTestReportText(section?.text);
  if(key==='expertRecovery'||key==='counseling'||key==='professionalSummary')return formatNumberedRecoveryText(section?.text);
  return mmlRepairBrokenPhrases(section?.text);
}
function derivedParagraphHtml(text,key){
  const normalized=mmlRepairBrokenPhrases(text);
  if(!normalized)return '';
  const html=[];

  if(key==='individualTests'){
    const parts=normalized.split(/(?=^■\s*)/m).map(v=>v.trim()).filter(Boolean);
    for(const part of parts){
      const lines=part.split(/\n+/).map(v=>v.trim()).filter(Boolean);
      const heading=String(lines.shift()||'').replace(/^■\s*/,'').trim();
      if(heading)html.push(`<h4 class="mml-derived-test-title">${esc(heading)}</h4>`);
      mmlComposeParagraphs(lines.join(' '),{target:155,max:270,maxSentences:3}).forEach(paragraph=>html.push(`<p>${esc(paragraph)}</p>`));
    }
    return html.join('');
  }

  if(key==='expertRecovery'){
    const chunks=normalized.split(/(?=^\d{1,2}\.\s*)/m).map(v=>v.trim()).filter(Boolean);
    for(const chunk of chunks){
      const numbered=chunk.match(/^(\d{1,2})\.\s*(.*)$/s);
      if(!numbered){mmlComposeParagraphs(chunk,{target:165,max:290,maxSentences:3}).forEach(p=>html.push(`<p>${esc(p)}</p>`));continue;}
      const number=numbered[1];
      let body=numbered[2].trim();
      const sentenceParts=mmlSentenceParts(body);
      let title='실천 방향';
      if(sentenceParts.length){
        const first=sentenceParts[0];
        const colon=first.match(/^(.{2,34}?)(?:[:：]|\s+-\s+)(.+)$/);
        if(colon){title=colon[1].trim();body=[colon[2].trim(),...sentenceParts.slice(1)].join(' ');}
        else if(first.length<=34&&!/[.!?。！？]$/.test(first)){title=first;body=sentenceParts.slice(1).join(' ');}
      }
      html.push(`<h4 class="mml-derived-recovery-title"><span>${esc(number)}</span>${esc(title)}</h4>`);
      mmlComposeParagraphs(body,{target:165,max:290,maxSentences:3}).forEach(paragraph=>html.push(`<p>${esc(paragraph)}</p>`));
    }
    return html.join('');
  }

  mmlComposeParagraphs(normalized,{target:175,max:300,maxSentences:3}).forEach(paragraph=>html.push(`<p>${esc(paragraph)}</p>`));
  return html.join('');
}
function derivedReportFormSectionHtml(section,index){
  const label=esc(String(section.label||`영역 ${index+1}`).replace(/^\s*\d+\s*[.．)]\s*/,''));
  const key=String(section?.key||'');
  const text=derivedParagraphHtml(formatDerivedSectionText(section),key);
  const variant=key==='coreMind'?'hero':key==='mindProfile'?'profile':key==='individualTests'?'tests':key==='expertRecovery'?'recovery':key==='emotionState'?'emotion':key==='thinkingRelationship'?'relation':key==='stressDaily'?'stress':'standard';
  return `<section class="mml-derived-form-section mml-derived-form-section--${variant}" data-derived-section="${index}" data-derived-key="${esc(key)}">
    <div class="mml-derived-form-number">${String(index+1).padStart(2,'0')}</div>
    <div class="mml-derived-form-body">
      <div class="mml-derived-form-title-row"><h3>${label}</h3><span class="mml-derived-form-rule"></span></div>
      <div class="mml-derived-form-editable" contenteditable="false" spellcheck="false" data-derived-index="${index}" data-placeholder="이 영역의 내용을 입력해 주세요.">${text}</div>
    </div>
  </section>`;
}
function derivedReportResultPageShell(pageIndex=0){
  return `<article class="mml-derived-form-page mml-derived-form-result-page" data-derived-result-page="${pageIndex}">
    <div class="mml-derived-form-head"><b>심리검사 종합결과</b><span>모두의 마음연구소</span></div>
    <div class="mml-derived-form-page-body"></div>
    <div class="mml-derived-form-footer"><span>모두의 마음연구소 · 심리검사 종합결과보고서</span><span data-derived-page-number></span></div>
  </article>`;
}
const DERIVED_CLIENT_SECTION_SCHEMA=Object.freeze([
  Object.freeze({key:'coreMind',label:'현재 마음의 핵심 모습',fallbackKeys:['coreMind','clientCoreMind','summary','keyMessage','integratedUnderstanding','professionalSummary']}),
  Object.freeze({key:'mindProfile',label:'마음 프로파일',fallbackKeys:['mindProfile','clientMindProfile','strengthsResources','evaluationOverview']}),
  Object.freeze({key:'individualTests',label:'개별검사 요약',fallbackKeys:['individualTests','clientIndividualTests','testFindings','testGuide']}),
  Object.freeze({key:'emotionState',label:'정서와 심리상태',fallbackKeys:['emotionState','clientEmotionState','emotionalProfile','currentSignals']}),
  Object.freeze({key:'thinkingRelationship',label:'사고와 관계 방식',fallbackKeys:['thinkingRelationship','clientThinkingRelationship','thinkingStyle','relationshipStyle']}),
  Object.freeze({key:'stressDaily',label:'스트레스와 일상생활',fallbackKeys:['stressDaily','clientStressDaily','stressRecovery']}),
  Object.freeze({key:'expertRecovery',label:'전문가 제언 및 회복 방향',fallbackKeys:['expertRecovery','clientExpertRecovery','psychologicalSuggestions','directions','professionalSummary']})
]);
function derivedSectionMap(report){
  return new Map((Array.isArray(report?.sections)?report.sections:[]).map(section=>[String(section?.key||''),section]));
}
function derivedSourceFields(report){
  const source=integratedReportById(report?.sourceIntegratedReportId)||{};
  return {...(source.sections||{}),...(source.masterReport||{}),...(source.clinicalProfile||{})};
}
function firstDerivedFallback(source,keys){
  for(const key of keys){
    const text=cleanReportText(source?.[key]);
    if(text)return text;
  }
  return '';
}
function canonicalDerivedClientSections(report){
  const byKey=derivedSectionMap(report);
  const source=derivedSourceFields(report);
  return DERIVED_CLIENT_SECTION_SCHEMA.map(definition=>{
    const saved=byKey.get(definition.key)||{};
    // 저장된 내담자용 섹션을 단일 원본으로 사용합니다.
    // 원본 AI 종합해석 필드는 저장된 섹션이 비어 있을 때만 하나의 대체값으로 사용하며,
    // 여러 필드를 이어 붙이지 않습니다. 이 규칙이 렌더링 단계의 중복 재발을 막습니다.
    const savedText=cleanReportText(saved.text);
    const text=savedText||firstDerivedFallback(source,definition.fallbackKeys);
    return {...saved,key:definition.key,label:saved.label||definition.label,text};
  });
}
function normalizeDerivedClientReport(report){
  if(!report||report.audience==='counselor')return report;
  const disclaimer=(Array.isArray(report.sections)?report.sections:[]).find(section=>section?.key==='disclaimer');
  const sections=canonicalDerivedClientSections(report);
  return {...report,sections:disclaimer?[...sections,disclaimer]:sections};
}
function derivedReportFormPagesHtml(report){
  // V93: 결과 보고서의 A4 페이지 기본 틀을 사용하지 않습니다.
  // 01~07 영역을 하나의 연속 문서에 그대로 렌더링하고 화면·인쇄 모두 브라우저 흐름에 맡깁니다.
  const sections=canonicalDerivedClientSections(report);
  const disclaimer=(Array.isArray(report?.sections)?report.sections:[]).find(section=>section?.key==='disclaimer');
  return `<section class="mml-derived-form-document mml-derived-form-result-page" data-derived-result-page="0">
    <div class="mml-derived-form-head"><b>심리검사 종합결과</b><span>모두의 마음연구소</span></div>
    <div class="mml-derived-form-page-body">${sections.map((section,index)=>derivedReportFormSectionHtml(section,index)).join('')}
      <div class="mml-derived-form-note">${esc(cleanReportText(disclaimer?.text)||'이 보고서는 심리검사 결과를 바탕으로 현재 상태와 경향을 이해하기 위한 자료입니다. 최종 공개 전 전문가가 내용과 표현을 검토해야 합니다.')}</div>
    </div>
  </section>`;
}
function repaginateDerivedAssessmentReport(editor){
  // V91: 화면의 보고서 DOM을 다시 조립하지 않습니다.
  // 재조립 과정에서 contenteditable 본문이 일부 유실되던 문제를 막고,
  // 현재 화면에 존재하는 01~07 섹션과 저장 데이터를 그대로 유지합니다.
  if(!editor)return;
  const report=derivedAssessmentReportById(editor.dataset.reportId);if(!report)return;
  const expected=canonicalDerivedClientSections(report);
  const body=editor.querySelector('.mml-derived-form-result-page .mml-derived-form-page-body');
  if(!body)return;
  expected.forEach((section,index)=>{
    const key=String(section?.key||'');
    let node=body.querySelector(`[data-derived-key="${key}"]`);
    if(!node){
      const holder=document.createElement('div');
      holder.innerHTML=derivedReportFormSectionHtml(section,index);
      node=holder.firstElementChild;
      const note=body.querySelector('.mml-derived-form-note');
      if(note)body.insertBefore(node,note);else body.appendChild(node);
    }
    const editable=node?.querySelector('[data-derived-index]');
    if(editable&&!String(editable.innerText||editable.textContent||'').trim()){
      editable.textContent=formatDerivedSectionText(section);
    }
  });
}

function normalizedDerivedReportTitle(report){
  const isCounselor=report?.audience==='counselor'||String(report?.title||'').includes('상담자용');
  return isCounselor?'상담자용 종합보고서':'심리검사 종합보고서';
}
function openDerivedAssessmentReportForm(id){
  const report=derivedAssessmentReportById(id);if(!report)return;
  report.title=normalizedDerivedReportTitle(report);
  document.getElementById('mml-derived-report-editor')?.remove();
  const source=integratedReportById(report.sourceIntegratedReportId)||{};
  const tests=Array.isArray(report.tests)?report.tests.join(' · '):String(report.tests||source.tests||'');
  const issued=String(report.updatedAt||report.createdAt||new Date().toISOString()).slice(0,10).replaceAll('-','.');
  const wrap=document.createElement('div');
  wrap.id='mml-derived-report-editor';
  wrap.dataset.reportId=String(report.id);
  wrap.className='fixed inset-0 z-[100] overflow-y-auto bg-slate-950/75 p-2 sm:p-6';
  wrap.innerHTML=`<style>
    #mml-derived-report-editor *{box-sizing:border-box}
    .mml-derived-form-shell{max-width:1040px;margin:0 auto 40px}
    .mml-derived-form-document{position:relative;width:min(100%,920px);margin:0 auto 18px;padding:34px 42px;background:#fff;color:#253b35;font-family:'Pretendard','Noto Sans KR',Arial,sans-serif;box-shadow:0 18px 55px rgba(15,23,42,.28);overflow:visible}
    .mml-derived-cover-block{padding-top:46px;padding-bottom:34px}.mml-derived-cover-block:before,.mml-derived-form-result-page:before{content:'';position:absolute;left:0;right:0;top:0;height:10px;background:linear-gradient(90deg,#174d3e 0 64%,#c99556 64% 76%,#eef3f0 76% 100%)}
    .mml-derived-form-toolbar{position:sticky;top:8px;z-index:5;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding:14px 16px;border:1px solid #dbe6e1;border-radius:18px;background:rgba(255,255,255,.96);box-shadow:0 12px 35px rgba(15,23,42,.2);backdrop-filter:blur(8px)}
    .mml-derived-form-toolbar h2{margin:0;color:#173d33;font-size:17px;font-weight:900}.mml-derived-form-toolbar p{margin:4px 0 0;color:#64748b;font-size:11px}
    .mml-derived-form-actions{display:flex;flex-wrap:wrap;gap:8px}.mml-derived-form-actions button{border-radius:11px;padding:10px 14px;font-size:12px;font-weight:900;cursor:pointer}
    .mml-derived-form-page{position:relative;width:210mm;min-height:297mm;height:auto;margin:0 auto 18px;padding:18mm 17mm 17mm;background:#fff;box-shadow:0 18px 55px rgba(15,23,42,.28);color:#253b35;font-family:'Pretendard','Noto Sans KR',Arial,sans-serif;overflow:visible}
    .mml-derived-form-page:before{content:'';position:absolute;left:0;right:0;top:0;height:7mm;background:linear-gradient(90deg,#174d3e 0 64%,#c99556 64% 76%,#eef3f0 76% 100%)}
    .mml-derived-form-cover{position:relative;display:flex;flex-direction:column;justify-content:space-between}
    .mml-derived-cover-brand{display:flex;align-items:flex-start;justify-content:space-between;gap:24px}.mml-derived-cover-brand-main{max-width:600px}.mml-derived-cover-logo{display:flex;align-items:center;gap:10px;margin-top:2px}.mml-derived-cover-logo-mark{width:54px;height:54px;border:1.8px solid #174d3e;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#174d3e;font-size:13px;font-weight:900;letter-spacing:.08em}.mml-derived-cover-logo span{font-size:10px;font-weight:800;color:#315a4e;white-space:nowrap}
    .mml-derived-form-kicker{font-size:11px;font-weight:900;letter-spacing:.22em;color:#b07842}.mml-derived-form-title{margin:16px 0 0;font-size:36px;line-height:1.28;letter-spacing:-.035em;color:#123f34;font-weight:900}
    .mml-derived-form-sub{max-width:640px;margin-top:16px;font-size:13px;line-height:1.85;color:#6a7d76}.mml-derived-form-meta{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #cfddd7;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 8px 24px rgba(23,77,62,.06)}.mml-derived-form-meta div{background:#fff;padding:16px 18px;border-right:1px solid #e1e9e5;border-bottom:1px solid #e1e9e5}.mml-derived-form-meta div:nth-child(2n){border-right:0}.mml-derived-form-meta div:nth-last-child(-n+2){border-bottom:0}.mml-derived-form-meta b{display:block;margin-bottom:7px;font-size:10px;letter-spacing:.04em;color:#91a29b}.mml-derived-form-meta span{font-size:13px;font-weight:850;line-height:1.5;color:#223e35}
    .mml-derived-form-result-page{display:block;min-height:0;height:auto;overflow:visible}.mml-derived-form-continuous-page{min-height:0;height:auto;overflow:visible}.mml-derived-form-page-body{display:block;min-height:0;height:auto;overflow:visible}.mml-derived-form-result-page .mml-derived-form-footer{margin-top:24px}.mml-derived-form-head{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #174d3e;padding:10mm 0 12px;margin-bottom:18px}.mml-derived-form-head b{font-size:19px;letter-spacing:-.02em;color:#123f34}.mml-derived-form-head span{display:flex;align-items:center;gap:8px;font-size:10px;font-weight:800;color:#6f837b}.mml-derived-form-head span:before{content:'ㅁㄷㅁ';width:30px;height:30px;border:1px solid #174d3e;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#174d3e;font-size:8px;font-weight:900}
    .mml-derived-form-section{position:relative;display:grid;grid-template-columns:54px 1fr;gap:16px;padding:17px 0 19px;border-bottom:1px solid #dfe8e4;break-inside:auto;page-break-inside:auto}
    .mml-derived-form-number{width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:#174d3e;color:#fff;font-size:11px;font-weight:900;letter-spacing:.04em;box-shadow:0 8px 18px rgba(23,77,62,.16)}
    .mml-derived-form-title-row{display:flex;align-items:center;gap:13px;margin:1px 0 11px}.mml-derived-form-body h3{margin:0;color:#153f35;font-size:17px;letter-spacing:-.025em;font-weight:900}.mml-derived-form-rule{height:1px;flex:1;background:linear-gradient(90deg,#b9cec5,transparent)}
    .mml-derived-form-editable{min-height:76px;padding:17px 18px;border:1px solid #d7e3de;border-radius:16px;background:#fbfdfc;white-space:pre-wrap;font-size:12.5px;line-height:1.92;color:#334b43;outline:none;transition:.15s;box-shadow:0 8px 24px rgba(23,77,62,.045)}.mml-derived-form-editable p{margin:0 0 16px;line-height:1.9;word-break:keep-all;overflow-wrap:break-word;text-wrap:pretty}.mml-derived-form-editable p:last-child{margin-bottom:0}.mml-derived-test-title{margin:20px 0 10px;padding-top:2px;font-size:13px;line-height:1.55;color:#174d3e;font-weight:900}.mml-derived-test-title:first-child{margin-top:0}.mml-derived-recovery-title{display:flex;align-items:center;gap:9px;margin:20px 0 10px;font-size:13px;line-height:1.55;color:#80552f;font-weight:900}.mml-derived-recovery-title:first-child{margin-top:0}.mml-derived-recovery-title span{display:inline-flex;width:23px;height:23px;align-items:center;justify-content:center;border-radius:8px;background:#b07842;color:#fff;font-size:10px;flex:0 0 auto}
    .mml-derived-form-editable:hover{border-color:#87aa9d;background:#fff}.mml-derived-form-editable:focus{border:1px solid #b07842;background:#fff;box-shadow:0 0 0 4px rgba(176,120,66,.12)}.mml-derived-form-editable:empty:before{content:attr(data-placeholder);color:#a7b3ae}
    .mml-derived-form-section--hero{grid-template-columns:54px 1fr;padding-top:9px}.mml-derived-form-section--hero .mml-derived-form-number{background:#c99556;color:#fff}.mml-derived-form-section--hero .mml-derived-form-title-row{margin-bottom:12px}.mml-derived-form-section--hero .mml-derived-form-editable{padding:20px 22px;border:0;border-radius:18px;background:#174d3e;color:#fff;font-size:13px;line-height:1.95;box-shadow:0 14px 32px rgba(23,77,62,.2)}
    .mml-derived-form-section--profile .mml-derived-form-editable{background:linear-gradient(135deg,#f0f7f4,#fbfdfc);border-left:5px solid #7fa899}
    .mml-derived-form-section--tests .mml-derived-form-editable{background:#f7faf9;border-color:#cbdcd5;padding:18px 20px;line-height:2}.mml-derived-form-section--tests .mml-derived-form-number{background:#285f4e}
    .mml-derived-form-section--emotion .mml-derived-form-editable{background:#f4f8fb;border-left:5px solid #8aa7b7}
    .mml-derived-form-section--relation .mml-derived-form-editable{background:#f6f5fb;border-left:5px solid #9c95b4}
    .mml-derived-form-section--stress .mml-derived-form-editable{background:#fff9f1;border-left:5px solid #d0a56d}
    .mml-derived-form-section--recovery{padding-bottom:10px;border-bottom:0}.mml-derived-form-section--recovery .mml-derived-form-number{background:#b07842}.mml-derived-form-section--recovery .mml-derived-form-editable{background:linear-gradient(135deg,#fff8ef,#f9f3e9);border:1px solid #dec6a7;padding:19px 21px;box-shadow:0 10px 26px rgba(176,120,66,.08)}
    .mml-derived-form-continuation .mml-derived-form-number{visibility:hidden}.mml-derived-form-continuation{padding-top:8px}.mml-derived-form-note{margin-top:24px;padding:15px 17px;border-left:4px solid #b07842;background:#f8f4ee;font-size:11px;line-height:1.7;color:#6b6259}.mml-derived-print-meta{display:none}.mml-derived-form-footer{margin-top:auto;padding-top:10px;border-top:1px solid #dfe8e4;display:flex;justify-content:space-between;gap:12px;font-size:9px;color:#96a29d}
    @media(max-width:900px){.mml-derived-form-document{width:100%;padding:28px 20px}.mml-derived-form-page{width:100%;min-height:auto;padding:28px 20px}.mml-derived-form-cover{min-height:720px}.mml-derived-form-title{font-size:27px}.mml-derived-form-meta{grid-template-columns:1fr}.mml-derived-form-section{grid-template-columns:38px 1fr;gap:8px}}
    @media print{
      @page{size:A4;margin:0}
      html,body{margin:0!important;padding:0!important;background:#fff!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body>*:not(#mml-derived-report-editor){display:none!important}
      #mml-derived-report-editor{position:static!important;inset:auto!important;display:block!important;overflow:visible!important;background:#fff!important;padding:0!important}
      #mml-derived-report-editor .mml-derived-form-shell{width:210mm!important;max-width:none!important;margin:0!important}
      #mml-derived-report-editor .mml-derived-form-toolbar{display:none!important}
      #mml-derived-report-editor .mml-derived-form-document{width:auto!important;max-width:none!important;margin:0!important;padding:14mm 14mm!important;box-shadow:none!important;overflow:visible!important;background:#fff!important}
      #mml-derived-report-editor .mml-derived-cover-block{padding-top:16mm!important;padding-bottom:10mm!important;break-after:auto!important;page-break-after:auto!important}
      /* 화면 작성 폼 자체를 PDF 원본으로 사용한다. 표지·여백·글자·카드 크기를 변경하지 않는다. */
      #mml-derived-report-editor .mml-derived-form-page{width:auto!important;min-height:0!important;height:auto!important;margin:0!important;padding:14mm!important;box-shadow:none!important;overflow:visible!important;break-after:auto!important;page-break-after:auto!important}
      #mml-derived-report-editor .mml-derived-form-page:last-child{break-after:auto;page-break-after:auto}
      #mml-derived-report-editor .mml-derived-form-section{break-inside:auto;page-break-inside:auto}#mml-derived-report-editor .mml-derived-form-title-row{break-after:avoid;page-break-after:avoid}#mml-derived-report-editor .mml-derived-form-editable{overflow:visible!important}
      #mml-derived-report-editor .mml-derived-form-page-body{overflow:visible!important}
      #mml-derived-report-editor .mml-derived-print-meta{display:none!important}
      #mml-derived-report-editor [contenteditable="true"]{caret-color:transparent!important}
    }
  </style>
  <div class="mml-derived-form-shell">
    <div class="mml-derived-form-toolbar">
      <div><h2>${report?.audience==='counselor'?'상담자용 종합보고서 작성':'심리검사 종합보고서 작성'}</h2><p>AI 종합해석보고서를 바탕으로 생성된 정식 보고서를 검토·수정한 뒤 저장하세요. <span class="ml-2 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-extrabold text-indigo-700">Composer V5.9D</span></p><div style="margin-top:8px"><span style="display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:850;background:${report.approvedForClient?'#dcfce7':'#f1f5f9'};color:${report.approvedForClient?'#166534':'#475569'}">${report.approvedForClient?'승인완료 · 사용자 열람 가능':report.status==='saved'?'저장완료 · 승인대기':'작성 중'}</span></div></div>
      <div class="mml-derived-form-actions">
        <button id="mml-derived-edit-toggle" onclick="toggleDerivedAssessmentReportEdit(true)" style="border:1px solid #9bb8ad;background:#fff;color:#245244">수정</button>
        <button onclick="saveDerivedAssessmentReportFromForm(${report.id},false)" style="border:0;background:#285f4e;color:#fff">저장</button>
        <button onclick="approveDerivedAssessmentReportFromForm(${report.id})" style="border:0;background:${report.approvedForClient?'#b45309':'#4338ca'};color:#fff">${report.approvedForClient?'승인취소':'승인'}</button>
        <button onclick="printDerivedAssessmentReportForm()" style="border:1px solid #d97706;background:#fff;color:#b45309">PDF</button>
        <button onclick="document.getElementById('mml-derived-report-editor')?.remove()" style="border:1px solid #cbd5e1;background:#fff;color:#475569">닫기</button>
      </div>
    </div>
    <section class="mml-derived-form-document mml-derived-cover-block">
      <div class="mml-derived-cover-brand"><div class="mml-derived-cover-brand-main"><div class="mml-derived-form-kicker">MODUMAM LAB PSYCHOLOGICAL REPORT</div><h1 class="mml-derived-form-title" contenteditable="false" data-derived-title="true" spellcheck="false">${esc(normalizedDerivedReportTitle(report))}</h1><p class="mml-derived-form-sub">심리검사 결과를 통합하여 현재 마음의 특징과 회복 방향을 이해하기 쉽게 정리한 보고서입니다.</p></div><div class="mml-derived-cover-logo"><div class="mml-derived-cover-logo-mark">ㅁㄷㅁ</div><span>모두의 마음연구소</span></div></div>
      <div class="mml-derived-form-meta"><div><b>프로그램</b><span>${esc(programBaseName(report.program||source.program||'-'))}</span></div><div><b>실시 검사</b><span>${esc(tests||'-')}</span></div><div><b>작성일</b><span>${esc(issued)}</span></div><div><b>작성</b><span>임상심리사 백인영</span></div></div>
    </section>
    ${derivedReportFormPagesHtml(report)}
  </div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(()=>{wrap.scrollTop=0;});
}
function editDerivedAssessmentReport(id){openDerivedAssessmentReportForm(id)}
// FIX-20260722-SCREEN-ALL-DATA-V91
function printDerivedAssessmentReportForm(){
  const editor=document.getElementById('mml-derived-report-editor');
  if(!editor)return;
  const report=derivedAssessmentReportById(editor.dataset.reportId);
  if(report?.audience!=='counselor'){
    const required=['coreMind','mindProfile','individualTests','emotionState','thinkingRelationship','stressDaily','expertRecovery'];
    const missing=required.filter(key=>{
      const node=editor.querySelector(`[data-derived-key="${key}"] [data-derived-index]`);
      return !node||!String(node.innerText||node.textContent||'').trim();
    });
    if(missing.length){
      alert(`PDF 생성이 중단되었습니다. 내용이 없는 보고서 영역: ${missing.join(', ')}`);
      return;
    }
  }
  document.documentElement.classList.add('mml-derived-printing');
  const cleanup=()=>document.documentElement.classList.remove('mml-derived-printing');
  window.addEventListener('afterprint',cleanup,{once:true});
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
  setTimeout(cleanup,2000);
}
function saveDerivedAssessmentReportFromForm(id,openPdf=false,silent=false){
  const rows=derivedAssessmentReports();const idx=rows.findIndex(x=>String(x.id)===String(id));if(idx<0)return;
  const editor=document.getElementById('mml-derived-report-editor');if(!editor)return;
  const title=editor.querySelector('[data-derived-title="true"]')?.innerText?.trim();
  const isCounselor=rows[idx].audience==='counselor'||String(rows[idx].title||'').includes('상담자용');
  rows[idx].title=isCounselor?(title||'상담자용 종합보고서'):'심리검사 종합보고서';
  if(!isCounselor)rows[idx].audience=rows[idx].audience||'client';
  const canonical=canonicalDerivedClientSections(rows[idx]);
  const disclaimer=(Array.isArray(rows[idx].sections)?rows[idx].sections:[]).find(section=>section?.key==='disclaimer');
  rows[idx].sections=canonical.map(section=>{
    const key=String(section?.key||'');
    const parts=[...editor.querySelectorAll(`[data-derived-key="${key}"] [data-derived-index]`)].map(el=>(el.innerText||el.textContent||'').trim()).filter(Boolean);
    return {...section,text:parts.length?parts.join('\n\n'):String(section?.text||'')};
  });
  if(disclaimer)rows[idx].sections.push(disclaimer);
  rows[idx].status='saved';rows[idx].approvedForClient=false;rows[idx].updatedAt=new Date().toISOString();
  rows[idx]=normalizeDerivedClientReport(rows[idx]);
  saveDerivedAssessmentReports(rows);
  toggleDerivedAssessmentReportEdit(false);
  if(openPdf){
    printDerivedAssessmentReportForm();
  }else if(!silent){
    alert('종합보고서를 저장했습니다.');
  }
  return true;
}
function toggleDerivedAssessmentReportEdit(editing){
  const editor=document.getElementById('mml-derived-report-editor');
  if(!editor)return;
  editor.querySelectorAll('[data-derived-title="true"], [data-derived-index]').forEach(node=>{
    node.setAttribute('contenteditable',editing?'true':'false');
  });
  editor.classList.toggle('mml-derived-editing',Boolean(editing));
  const button=editor.querySelector('#mml-derived-edit-toggle');
  if(button){
    button.textContent=editing?'수정 중':'수정';
    button.disabled=Boolean(editing);
  }
  if(editing){
    const first=editor.querySelector('[data-derived-index]');
    first?.focus();
  }
}
async function approveDerivedAssessmentReportFromForm(id){
  const report=derivedAssessmentReportById(id);
  if(!report)return;
  if(report.approvedForClient){
    toggleDerivedAssessmentReportApproval(id);
    setTimeout(()=>openDerivedAssessmentReportForm(id),0);
    return;
  }
  const saved=saveDerivedAssessmentReportFromForm(id,false,true);
  if(!saved)return;
  await publishDerivedAssessmentReport(id);
  setTimeout(()=>openDerivedAssessmentReportForm(id),0);
}

window.openDerivedAssessmentReportForm=openDerivedAssessmentReportForm;
window.saveDerivedAssessmentReportFromForm=saveDerivedAssessmentReportFromForm;
window.toggleDerivedAssessmentReportEdit=toggleDerivedAssessmentReportEdit;
window.approveDerivedAssessmentReportFromForm=approveDerivedAssessmentReportFromForm;
window.printDerivedAssessmentReportForm=printDerivedAssessmentReportForm;
window.repaginateDerivedAssessmentReport=repaginateDerivedAssessmentReport;
async function previewDerivedAssessmentReport(id,printNow=false){
  const report=derivedAssessmentReportById(id);if(!report)return;
  if(report.audience!=='counselor'){
    openDerivedAssessmentReportForm(id);
    if(printNow)setTimeout(()=>printDerivedAssessmentReportForm(),180);
    return;
  }
  const source=integratedReportById(report.sourceIntegratedReportId)||{};
  const sections=report.sections||[];
  const getSection=(key)=>sections.find(x=>x.key===key)?.text||'';
  const tests=Array.isArray(report.tests)?report.tests.join(' · '):String(report.tests||source.tests||'');
  const issued=String(report.updatedAt||report.createdAt||new Date().toISOString()).slice(0,10).replaceAll('-','.');
  const win=openPrintWindow('','_blank');if(!win)return alert('팝업 차단을 해제해 주세요.');
  if(report.audience!=='counselor'){
    try{
      win.document.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>보고서 준비 중</title></head><body style="font-family:Arial,sans-serif;padding:40px;color:#334155">MODUMAM INTERNAL SUMMARY REPORT를 불러오는 중입니다.</body></html>');
      win.document.close();
      const sectionObject=Object.fromEntries((sections||[]).map(x=>[x.key,x.text||'']));
      const sourceMaster=source.masterReport||source.clinicalProfile||{};
      const sourceSections=source.sections||{};
      const response=await fetch('/.netlify/functions/comprehensive-report',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          audience:'client',clientName:report.clientName||source.clientName||'',program:programBaseName(report.program||source.program||''),
          tests:Array.isArray(report.tests)?report.tests:(Array.isArray(source.tests)?source.tests:[]),
          issuedAt:report.updatedAt||report.createdAt||new Date().toISOString(),
          report:{...sourceSections,...sourceMaster,...sectionObject}
        })
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.html)throw new Error(data.error||'심리검사 종합보고서를 렌더링하지 못했습니다.');
      const printScript=printNow?'<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script>':'';
      win.document.open();win.document.write(String(data.html).replace('</body>',`${printScript}</body>`));win.document.close();
      return;
    }catch(error){win.close();alert(error.message||'종합보고서를 불러오는 중 오류가 발생했습니다.');return;}
  }
  if(report.audience==='counselor'){
    const intro=firstReportText(getSection('professionalSummary'),getSection('integration'),getSection('clinicalProfile'));
    const firstPair=[['현재 심리상태',firstReportText(getSection('clinicalProfile'),getSection('integration'))],['상담 시 핵심 고려사항',firstReportText(getSection('counseling'),getSection('hypotheses'))]];
    const excluded=new Set(['professionalSummary','clinicalProfile','integration','counseling','hypotheses']);
    const remaining=sections.filter(x=>!excluded.has(x.key));
    const sectionHtml=remaining.map((x,i)=>`<section class="report-section"><div class="section-no">${String(i+2).padStart(2,'0')}</div><div class="section-body"><h2>${esc(x.label.replace(/^\d+\.\s*/,''))}</h2><p>${esc(x.text).replace(/\n/g,'<br>')}</p></div></section>`).join('');
    win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>${mmlDerivedReportCss('#3730a3')}</style></head><body><main class="page"><div class="topbar"></div><header><div class="eyebrow">MODUMAM PROFESSIONAL REPORT</div><h1 class="title">상담자용 종합보고서</h1><p class="subtitle">심리평가센터의 통합 결과를 상담 계획과 사례 이해에 활용할 수 있도록 정리한 보고서입니다.</p><div class="logo"><div class="logo-mark">ㅁㄷㅁ</div><span>모두의 마음연구소</span></div></header><div class="meta"><div><small>성명</small><b>${esc(report.clientName||'')}</b></div><div><small>프로그램</small><b>${esc(report.program||'')}</b></div><div><small>발행일</small><b>${issued}</b></div><div><small>실시검사</small><b>${esc(tests||'통합 심리검사')}</b></div></div><section class="glance"><small>CLINICAL SYNTHESIS</small><h2>상담을 위한 핵심 이해</h2><p>${esc(intro||'통합검사 결과를 바탕으로 상담 시 핵심 고려사항을 정리했습니다.').replace(/\n/g,'<br>')}</p></section><div class="first-title"><b>01</b><h2>핵심 임상 이해</h2></div><div class="cards">${firstPair.map(([title,text])=>`<div class="card"><h3>${esc(title)}</h3><p>${esc(text||'통합보고서 내용을 검토해 주세요.').replace(/\n/g,'<br>')}</p></div>`).join('')}</div>${sectionHtml}<p class="foot-note">본 보고서는 상담자의 임상적 검토와 수정 후 사용합니다.</p></main></body></html>`);
  }else{
    const core=firstReportText(getSection('coreMind'),getSection('summary'),getSection('professionalSummary'));
    const profile=firstReportText(getSection('mindProfile'));
    const individual=firstReportText(getSection('individualTests'),getSection('testFindings'));
    const emotion=firstReportText(getSection('emotionState'));
    const thinking=firstReportText(getSection('thinkingRelationship'));
    const stress=firstReportText(getSection('stressDaily'));
    const recovery=firstReportText(getSection('expertRecovery'),getSection('directions'),getSection('professionalSummary'));
    const disclaimer=firstReportText(getSection('disclaimer'),'이 보고서는 심리검사 결과를 바탕으로 현재의 상태와 경향을 이해하기 위한 참고자료이며, 검사 결과만으로 진단을 확정하지 않습니다.');
    const section=(no,title,text,kind='panel')=>`<section class="signature-section"><div class="signature-title"><b>${no}</b><h2>${title}</h2></div><div class="${kind}"><p>${esc(text||'통합보고서 내용을 검토해 주세요.').replace(/\n/g,'<br>')}</p></div></section>`;
    win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>${mmlDerivedReportCss('#0f4b3c')}</style></head><body><main class="report-wrap">
      <article class="page signature-page"><div class="topbar"></div><header><div class="eyebrow">MODUMAM INTERNAL SUMMARY REPORT</div><h1 class="title">개인 마음이음 종합보고서</h1><p class="subtitle">심리검사 결과를 바탕으로 현재의 마음과 성격 특성을 이해하고, 회복과 상담에 도움이 되는 방향을 정리한 보고서입니다.</p><div class="logo"><div class="logo-mark">ㅁㄷㅁ</div><span>모두의 마음연구소</span></div></header><div class="meta"><div><small>성명</small><b>${esc(report.clientName||'')}</b></div><div><small>프로그램</small><b>${esc(report.program||'')}</b></div><div><small>발행일</small><b>${issued}</b></div><div><small>실시검사</small><b>${esc(tests||'통합 심리검사')}</b></div></div><section class="glance numbered-hero"><div class="hero-no">01</div><div><small>MY MIND AT A GLANCE</small><h2>현재 마음의 핵심 모습</h2><p>${esc(core||'통합검사 결과를 바탕으로 현재 마음의 핵심 모습을 정리했습니다.').replace(/\n/g,'<br>')}</p></div></section>${section('02','마음 프로파일',profile,'profile-card')}<div class="page-footer">MODUMAM INTERNAL SUMMARY REPORT <span>1 / 3</span></div></article>
      <article class="page signature-page"><div class="topbar"></div><header class="inner-header"><div><div class="eyebrow">UNDERSTANDING MY RESULTS</div><h1 class="inner-title">검사 결과로 나를 이해하기</h1></div><span>${esc(report.clientName||'')}</span></header>${section('03','개별검사 요약',individual,'test-card')}${section('04','정서와 심리상태',emotion,'soft-card')}<div class="page-footer">MODUMAM INTERNAL SUMMARY REPORT <span>2 / 3</span></div></article>
      <article class="page signature-page"><div class="topbar"></div><header class="inner-header"><div><div class="eyebrow">INTEGRATED UNDERSTANDING</div><h1 class="inner-title">통합적 이해와 회복 방향</h1></div><span>${esc(report.clientName||'')}</span></header>${section('05','사고와 관계 방식',thinking,'plain-card')}${section('06','스트레스와 일상생활',stress,'soft-card')}${section('07','전문가 제언 및 회복 방향',recovery,'recovery-card')}<div class="report-notice"><h3>보고서 안내</h3><p>${esc(disclaimer).replace(/\n/g,'<br>')}</p></div><div class="page-footer">MODUMAM INTERNAL SUMMARY REPORT <span>3 / 3</span></div></article>
    </main></body></html>`);
  }
  win.document.close();if(printNow)setTimeout(()=>win.print(),350);
}
function mmlDerivedReportCss(accent){return `@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0}body{background:#e9efec;color:#12352d;font-family:Arial,'Noto Sans KR',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.report-wrap{padding:16px 0}.page{position:relative;width:210mm;min-height:297mm;margin:0 auto 16px;background:#fff;padding:0 13mm 10mm;display:flex;flex-direction:column;overflow:hidden}.topbar{height:7mm;margin:0 -13mm 10mm;background:linear-gradient(90deg,#0f4b3c 0 61%,#c99754 61% 73%,#e8efec 73%)}header{position:relative;border-bottom:1px solid #b8c8c2;padding:0 0 4mm}.eyebrow{font-size:8px;letter-spacing:2.4px;font-weight:900;color:#a25f1e}.title{font-size:25px;line-height:1.2;margin:4px 0 5px;color:#073c33}.subtitle{font-size:10px;color:#526e66;line-height:1.6;max-width:150mm}.logo{position:absolute;right:0;top:4px;display:flex;align-items:center;gap:8px;font-size:8px;font-weight:800}.logo-mark{width:15mm;height:15mm;border:1.6px solid #0f4b3c;border-radius:50%;display:grid;place-items:center;font-size:11px;letter-spacing:1px}.meta{display:grid;grid-template-columns:1fr 1fr 1fr 1.15fr;border:1px solid #cbd8d3;border-radius:10px;overflow:hidden;margin:5mm 0 4mm}.meta>div{padding:3mm;border-right:1px solid #d8e1de;min-height:17mm}.meta>div:last-child{border-right:0}.meta small{display:block;font-size:7px;color:#83948f;margin-bottom:2mm}.meta b{font-size:9px;line-height:1.45;color:#12352d}.glance{border-radius:11px;background:${accent};color:white;padding:6mm;margin-bottom:5mm}.numbered-hero{display:grid;grid-template-columns:12mm 1fr;gap:3mm;align-items:start}.hero-no{font-size:17px;font-weight:900;color:#e8b46e;padding-top:1mm}.glance small{font-size:7px;color:#e9b567;font-weight:900}.glance h2{font-size:16px;margin:2mm 0}.glance p{font-size:9.5px;line-height:1.75;margin:0;font-weight:600}.signature-section{border-top:1px solid #d8e1de;padding:4mm 0;break-inside:avoid}.signature-title{display:flex;align-items:center;gap:4mm;margin-bottom:3mm}.signature-title b{font-size:16px;color:#b26b22}.signature-title h2{font-size:14px;margin:0;color:#12352d}.profile-card,.test-card,.soft-card,.plain-card,.recovery-card{border:1px solid #d4dfdb;border-radius:10px;padding:4.5mm;background:#fff}.profile-card{background:#eef6f2;border-color:#cfe3d9}.test-card{border-left:4px solid #a96e35;background:#f8faf9}.soft-card{background:#fff7ee;border-color:#e8cfad}.recovery-card{background:#0f4b3c;color:#fff;border-color:#0f4b3c}.profile-card p,.test-card p,.soft-card p,.plain-card p,.recovery-card p{font-size:9px;line-height:1.72;margin:0}.recovery-card p{color:#fff}.inner-header{display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:4mm}.inner-title{font-size:21px;margin:4px 0 0;color:#073c33}.inner-header>span{font-size:8px;color:#71817a}.report-notice{margin-top:4mm;border:1px solid #d4dfdb;border-radius:10px;padding:3.5mm;background:#f8faf9}.report-notice h3{font-size:10px;margin:0 0 2mm}.report-notice p{font-size:8px;line-height:1.55;margin:0;color:#6d8179}.page-footer{margin-top:auto;border-top:1px solid #d8e1de;padding-top:3mm;font-size:7px;color:#7d918b;display:flex;justify-content:space-between}.first-title{display:flex;align-items:center;gap:3mm;margin:0 0 2mm}.first-title b{font-size:16px;color:#b26b22}.first-title h2{font-size:14px;margin:0}.cards{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.card{border:1px solid #d4dfdb;border-radius:10px;padding:4mm;background:#f0f7f4}.card h3{font-size:10px;margin:0 0 2mm}.card p,.report-section p{font-size:9px;line-height:1.72;margin:0}.report-section{display:grid;grid-template-columns:12mm 1fr;gap:3mm;border-top:1px solid #d8e1de;padding:4mm 0}.section-no{font-size:14px;font-weight:900;color:#b26b22}.section-body h2{font-size:12px;margin:0 0 2mm}.foot-note{margin-top:auto;border-top:1px solid #d8e1de;padding-top:3mm;font-size:7px;color:#7d918b}@media print{html,body{width:210mm;background:#fff}.report-wrap{padding:0}.page{width:210mm;height:297mm;min-height:297mm;margin:0;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}.signature-section,.glance,.meta,header,.report-notice{break-inside:avoid;page-break-inside:avoid}h1,h2,h3{break-after:avoid;page-break-after:avoid}p{orphans:3;widows:3}}`;}


// MOD-20260720-REQUEST-LINKED-CLIENT-REPORT-V8
function assessmentReportRequestForReservation(reservationId,clientName='',clientPhone=''){
  // [MOD-20260722-REQUEST-MERGE-FIX-V98]
  // 같은 예약이 사용자/관리자 저장소에서 서로 다른 id로 복제될 수 있으므로,
  // id 한 건만 찾지 않고 예약자·연락처·일정이 일치하는 모든 신청 레코드를 병합합니다.
  let localRows=[];
  let standaloneRequests=[];
  try{localRows=JSON.parse(localStorage.getItem('modumam_reservations')||'[]')||[]}catch(e){localRows=[]}
  try{standaloneRequests=JSON.parse(localStorage.getItem('modumam_assessment_report_requests_v1')||'[]')||[]}catch(e){standaloneRequests=[]}
  const runtimeRows=Array.isArray(state.reservations)?state.reservations:[];
  const requestRows=(Array.isArray(standaloneRequests)?standaloneRequests:[]).filter(row=>row&&row.status!=='cancelled').map(row=>({
    id:String(row.reservationId||row.id||''),
    assessmentReportRequested:true,
    assessmentReportRequestedAt:row.requestedAt||row.updatedAt||'',
    assessmentReportTypes:[row.reportType==='individual'?'individual':'integrated'],
    assessmentIndividualReportRequested:row.reportType==='individual',
    assessmentIntegratedReportRequested:row.reportType!=='individual',
    comprehensiveReportRequested:row.reportType!=='individual',
    assessmentIndividualTests:row.reportType==='individual'?[row.testCode].filter(Boolean):(Array.isArray(row.tests)?row.tests:[]),
    assessmentReportApplication:{
      reportTypes:[row.reportType==='individual'?'individual':'integrated'],
      individualReportRequested:row.reportType==='individual',
      integratedReportRequested:row.reportType!=='individual',
      comprehensiveReportRequested:row.reportType!=='individual',
      individualTests:row.reportType==='individual'?[row.testCode].filter(Boolean):(Array.isArray(row.tests)?row.tests:[]),
      submittedAt:row.requestedAt||row.updatedAt||''
    },
    name:row.clientName||row.name||'',
    phone:row.phone||row.clientPhone||'',
    program:row.program||row.bookingProgram||'',
    bookingProgram:row.program||row.bookingProgram||'',
    date:row.date||row.bookingDate||'',
    time:row.time||row.bookingTime||'',
    bookingCategory:row.bookingCategory||'',
    __standaloneReportRequest:true
  }));
  const rows=[...localRows,...runtimeRows,...requestRows].filter(Boolean);
  const normName=v=>String(v||'').replace(/\s+/g,'').toLowerCase();
  const normPhone=v=>String(v||'').replace(/[^0-9]/g,'');
  const normDate=v=>String(v||'').replace(/[^0-9]/g,'');
  const wantedName=normName(clientName);
  const wantedPhone=normPhone(clientPhone);
  const target=rows.find(r=>reservationId&&String(r.id)===String(reservationId))||{};
  const targetName=wantedName||normName(target.name);
  const targetPhone=wantedPhone||normPhone(target.phone);
  const targetDate=normDate(target.date);
  const targetTime=String(target.time||'').trim();

  const isSamePerson=(r)=>{
    const rowName=normName(r.name);
    const rowPhone=normPhone(r.phone);
    const nameMatch=Boolean(targetName&&rowName===targetName);
    const phoneMatch=Boolean(targetPhone&&rowPhone&&(rowPhone.endsWith(targetPhone)||targetPhone.endsWith(rowPhone)));
    return phoneMatch||(nameMatch&&(!targetPhone||!rowPhone));
  };
  const isSameSchedule=(r)=>{
    if(!targetDate&&!targetTime)return true;
    const dateMatch=!targetDate||!normDate(r.date)||normDate(r.date)===targetDate;
    const timeMatch=!targetTime||!String(r.time||'').trim()||String(r.time||'').trim()===targetTime;
    return dateMatch&&timeMatch;
  };
  const candidates=rows.filter(r=>{
    if(reservationId&&String(r.id)===String(reservationId))return true;
    return isSamePerson(r)&&isSameSchedule(r);
  });
  if(!candidates.length)return null;

  const union=(...lists)=>[...new Set(lists.flat().filter(Boolean))];
  const merge=(a={},b={})=>{
    const aApp=a.assessmentReportApplication||{};
    const bApp=b.assessmentReportApplication||{};
    const aTypes=Array.isArray(a.assessmentReportTypes)?a.assessmentReportTypes:[];
    const bTypes=Array.isArray(b.assessmentReportTypes)?b.assessmentReportTypes:[];
    const appTypes=union(Array.isArray(aApp.reportTypes)?aApp.reportTypes:[],Array.isArray(bApp.reportTypes)?bApp.reportTypes:[]);
    const mergedProgram=String(b.bookingProgram||a.bookingProgram||b.program||a.program||'');
    const compactProgram=mergedProgram.replace(/[\s·_-]+/g,'');
    const programDefaults=compactProgram.includes('부모자녀마음이음')
      ? ['PAT','K-CDI']
      : compactProgram.includes('부부마음이음')
        ? ['TCI']
        : compactProgram.includes('개인마음이음')
          ? ['TCI']
          : [];
    const tests=union(
      programDefaults,
      Array.isArray(a.assessmentIndividualTests)?a.assessmentIndividualTests:[],
      Array.isArray(b.assessmentIndividualTests)?b.assessmentIndividualTests:[],
      Array.isArray(aApp.individualTests)?aApp.individualTests:[],
      Array.isArray(bApp.individualTests)?bApp.individualTests:[],
      Array.isArray(a.requestedIndividualTests)?a.requestedIndividualTests:[],
      Array.isArray(b.requestedIndividualTests)?b.requestedIndividualTests:[],
      Array.isArray(a.individualReports)?a.individualReports:[],
      Array.isArray(b.individualReports)?b.individualReports:[],
      Array.isArray(a.reportRequestedTests)?a.reportRequestedTests:[],
      Array.isArray(b.reportRequestedTests)?b.reportRequestedTests:[],
      Array.isArray(a.extraTests)?a.extraTests:[],
      Array.isArray(b.extraTests)?b.extraTests:[],
      Array.isArray(a.selectedTests)?a.selectedTests:[],
      Array.isArray(b.selectedTests)?b.selectedTests:[]
    ).filter(t=>String(t||'').trim()!=='행동관찰');
    // [MOD-20260726-REPORT-POLICY-V2]
    // 마음이음 프로그램은 기본검사+추가검사를 통합하므로 항상 종합보고서입니다.
    // 개별 심리검사 예약만 1개=개별, 2개 이상=종합으로 분기합니다.
    const isIndividualBooking=(b.bookingCategory||a.bookingCategory)==='individual-test'||mergedProgram.includes('개별 심리검사');
    const isMindLinkProgram=mergedProgram.includes('개인 마음이음')||mergedProgram.includes('부부 마음이음')||mergedProgram.includes('부모-자녀 마음이음')||mergedProgram.includes('부모자녀 마음이음');
    const requestedTestCount=tests.length;
    const individual=isIndividualBooking&&requestedTestCount===1;
    const comprehensive=isMindLinkProgram||(isIndividualBooking&&requestedTestCount>=2)||(!isIndividualBooking&&requestedTestCount>=2);
    const types=individual?['individual']:(comprehensive?['integrated']:[]);
    const requestedAt=b.assessmentReportRequestedAt||bApp.submittedAt||a.assessmentReportRequestedAt||aApp.submittedAt||'';
    return {
      ...a,...b,
      id:target.id||b.id||a.id,
      assessmentReportRequested:Boolean(a.assessmentReportRequested||b.assessmentReportRequested||individual||comprehensive),
      assessmentReportRequestedAt:requestedAt,
      assessmentReportTypes:types,
      assessmentIndividualReportRequested:individual,
      assessmentIntegratedReportRequested:comprehensive,
      comprehensiveReportRequested:comprehensive,
      assessmentIndividualTests:tests,
      assessmentReportApplication:{
        ...aApp,...bApp,
        reportTypes:types,
        individualReportRequested:individual,
        integratedReportRequested:comprehensive,
        comprehensiveReportRequested:comprehensive,
        individualTests:tests,
        submittedAt:requestedAt||bApp.submittedAt||aApp.submittedAt||''
      }
    };
  };
  const merged=candidates.reduce((acc,row)=>merge(acc,row),{});
  return merged.assessmentReportRequested===true?merged:null;
}

function normalizeReportRequestTestName(value){
  const original=String(value||'').trim();
  const raw=original.toUpperCase().replace(/[^A-Z0-9가-힣]/g,'');
  if(raw.includes('MMPI2')||raw==='MMPI')return 'MMPI-2';
  if(raw.includes('KCDI'))return 'K-CDI';
  if(raw.includes('PHQ9'))return 'PHQ-9';
  if(raw.includes('GAD7'))return 'GAD-7';
  if(raw.includes('TCI'))return 'TCI';
  if(raw.includes('PAI'))return 'PAI';
  if(raw.includes('SCT')||original.includes('문장완성'))return 'SCT';
  if(raw.includes('HTP')||(original.includes('집')&&original.includes('나무')))return 'HTP';
  if(raw.includes('STS'))return 'STS';
  if(raw.includes('PAT'))return 'PAT';
  return original;
}
function assessmentReportRequestMatch(reservationId,reportType,testType='',clientName='',clientPhone=''){
  const request=assessmentReportRequestForReservation(reservationId,clientName,clientPhone);
  if(!request)return null;
  const app=request.assessmentReportApplication||{};
  const types=Array.isArray(request.assessmentReportTypes)?request.assessmentReportTypes:(Array.isArray(app.reportTypes)?app.reportTypes:[]);
  if(reportType==='comprehensiveReport'){
    const requested=Boolean(request.assessmentIntegratedReportRequested||request.comprehensiveReportRequested||request.requestedComprehensiveReport||app.integratedReportRequested||app.comprehensiveReportRequested||types.includes('integrated')||types.includes('comprehensive'));
    return requested?request:null;
  }
  if(reportType==='individualReport'){
    const requested=Boolean(request.assessmentIndividualReportRequested||app.individualReportRequested||types.includes('individual'));
    if(!requested)return null;
    const tests=[
      ...(Array.isArray(request.assessmentIndividualTests)?request.assessmentIndividualTests:[]),
      ...(Array.isArray(app.individualTests)?app.individualTests:[]),
      ...(Array.isArray(request.requestedIndividualTests)?request.requestedIndividualTests:[]),
      ...(Array.isArray(request.individualReports)?request.individualReports:[]),
      ...(Array.isArray(request.reportRequestedTests)?request.reportRequestedTests:[])
    ].map(normalizeReportRequestTestName).filter(Boolean);
    return [...new Set(tests)].includes(normalizeReportRequestTestName(testType))?request:null;
  }
  return request;
}
function reportHasMatchingClientRequest(report){
  if(!report)return null;
  const type=canonicalReportType(report);
  if(type!=='individualReport'&&type!=='comprehensiveReport')return null;
  return assessmentReportRequestMatch(report.reservationId,type,report.testType,report.clientName,report.phone);
}
async function captureApprovedDerivedAssessmentReportHtml(id){
  const report=derivedAssessmentReportById(id);
  if(!report)throw new Error('승인할 심리검사 종합보고서를 찾지 못했습니다.');
  let editor=document.getElementById('mml-derived-report-editor');
  const hadExisting=Boolean(editor&&String(editor.dataset.reportId)===String(id));
  if(!hadExisting){
    openDerivedAssessmentReportForm(id);
    editor=document.getElementById('mml-derived-report-editor');
    if(!editor)throw new Error('관리자 종합보고서 작성 폼을 불러오지 못했습니다.');
    editor.style.visibility='hidden';
    editor.style.pointerEvents='none';
    editor.style.left='-100000px';
    editor.style.width='100vw';
  }
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  repaginateDerivedAssessmentReport(editor);
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const style=editor.querySelector('style')?.textContent||'';
  const shell=editor.querySelector('.mml-derived-form-shell')?.cloneNode(true);
  if(!shell)throw new Error('관리자 종합보고서 출력 화면을 저장하지 못했습니다.');
  shell.querySelector('.mml-derived-form-toolbar')?.remove();

  // [FIX-20260722-SAME-REPORT-CONTENT-V83]
  // DOM 복제 과정에서 contenteditable의 표시 문자열이 누락되더라도,
  // 승인 대상 보고서의 저장된 sections를 같은 관리자 양식에 다시 주입합니다.
  const storedSections=canonicalDerivedClientSections(report);
  storedSections.forEach((section,index)=>{
    const nodes=[...shell.querySelectorAll(`[data-derived-index="${index}"]`)];
    const savedText=formatDerivedSectionText(section).trim();
    const capturedText=nodes.map(node=>(node.innerText||node.textContent||'').trim()).filter(Boolean).join('\n').trim();
    // cloneNode/contenteditable 조합에서 본문이 비거나 일부만 복제되는 경우에도
    // 승인본에는 저장된 관리자 원문 전체가 반드시 포함되도록 강제합니다.
    if(savedText&&nodes.length&&capturedText.length<Math.max(8,Math.floor(savedText.length*.35))){
      nodes[0].textContent=savedText;
      nodes.slice(1).forEach(node=>node.closest('.mml-derived-form-section')?.remove());
    }
  });
  shell.querySelectorAll('[contenteditable]').forEach(el=>{
    el.removeAttribute('contenteditable');el.removeAttribute('spellcheck');el.removeAttribute('data-placeholder');
  });
  // data-derived-index는 사용자 열람 시 승인 원문 검증·복구에 사용하므로 유지합니다.
  shell.querySelectorAll('[data-derived-title]').forEach(el=>el.removeAttribute('data-derived-title'));
  if(!hadExisting)editor.remove();
  const approvedStyle=`${style}\nhtml,body{margin:0!important;padding:0!important;background:#e8eeeb!important}#mml-derived-report-editor{position:static!important;inset:auto!important;display:block!important;overflow:visible!important;background:#e8eeeb!important;padding:16px 0!important}#mml-derived-report-editor .mml-derived-form-toolbar{display:none!important}#mml-derived-report-editor .mml-derived-form-page{box-shadow:none!important} @media print{#mml-derived-report-editor{padding:0!important;background:#fff!important}}`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="mml-report-template" content="MML_ADMIN_DERIVED_REPORT_V1"><title>심리검사 종합보고서</title><style>${approvedStyle}</style></head><body><!-- MML_ADMIN_DERIVED_REPORT_V1 --><div id="mml-derived-report-editor">${shell.outerHTML}</div></body></html>`;
}


function saveCanonicalPublishedReport(report){
  if(!report)return report;

  try{
    if(window.MMLUnifiedAIReportEngine?.save){
      return window.MMLUnifiedAIReportEngine.save(report);
    }
  }catch(error){
    console.warn('[MML] 승인 보고서 통합 엔진 저장 fallback',error);
  }

  try{
    if(window.MMLReportStore?.saveReport){
      const rows=window.MMLReportStore.saveReport(report);
      return (rows||[]).find(item=>String(item.id)===String(report.id))||report;
    }
  }catch(error){
    console.warn('[MML] 승인 보고서 공통 저장소 fallback',error);
  }

  let rows=[];
  try{rows=JSON.parse(localStorage.getItem('modumam_reports')||'[]')||[]}catch(_){rows=[]}
  const index=rows.findIndex(item=>String(item.id)===String(report.id));
  if(index>=0)rows[index]={...rows[index],...report};
  else rows.unshift(report);
  localStorage.setItem('modumam_reports',JSON.stringify(rows));
  return report;
}

function removeCanonicalPublishedReportByDerivedId(derivedReportId){
  let rows=[];
  try{
    rows=window.MMLReportStore?.loadAll
      ? window.MMLReportStore.loadAll()
      : JSON.parse(localStorage.getItem('modumam_reports')||'[]')||[];
  }catch(_){rows=[]}

  const next=(rows||[]).filter(item=>String(item.derivedReportId)!==String(derivedReportId));

  try{
    if(window.MMLReportStore?.saveAll){
      window.MMLReportStore.saveAll(next);
      return next;
    }
  }catch(error){
    console.warn('[MML] 승인취소 공통 저장소 fallback',error);
  }

  localStorage.setItem('modumam_reports',JSON.stringify(next));
  return next;
}

const mmlDerivedApprovalLocks=new Set();
async function publishDerivedAssessmentReport(id){
  const lockKey=String(id);
  if(mmlDerivedApprovalLocks.has(lockKey))return;
  mmlDerivedApprovalLocks.add(lockKey);
  const rows=derivedAssessmentReports();
  const idx=rows.findIndex(x=>String(x.id)===String(id));
  if(idx<0){mmlDerivedApprovalLocks.delete(lockKey);return;}
  const report=rows[idx];
  if(report.audience!=='client'){mmlDerivedApprovalLocks.delete(lockKey);alert('심리검사 종합보고서만 공개할 수 있습니다.');return;}
  const source=integratedReportById(report.sourceIntegratedReportId)||{};
  const reservationId=String(report.reservationId||source.reservationId||'');
  // 사용자 신청 여부와 관계없이 저장된 종합보고서가 있으면 승인할 수 있습니다.
  const now=new Date().toISOString();
  const reportSections=canonicalDerivedClientSections(report);
  const emptySections=reportSections.filter(section=>!String(section?.text||'').trim());
  if(!reportSections.length||emptySections.length===reportSections.length){
    mmlDerivedApprovalLocks.delete(lockKey);
    alert('종합보고서 내용이 비어 있어 승인할 수 없습니다. 관리자 보고서를 먼저 생성·저장해 주세요.');
    return;
  }
  let approvedReportHtml='';
  try{
    // [MOD-20260722-SAME-ADMIN-CLIENT-REPORT-V82]
    // 관리자에서 실제로 확인한 종합보고서 화면 전체를 승인 원본으로 저장합니다.
    // 사용자 모드는 이 HTML을 그대로 열며 별도 보고서를 생성하지 않습니다.
    approvedReportHtml=await captureApprovedDerivedAssessmentReportHtml(report.id);
  }catch(error){mmlDerivedApprovalLocks.delete(lockKey);alert(error.message||'관리자 종합보고서 출력본을 저장하지 못했습니다.');return;}
  if(!approvedReportHtml.includes('MML_ADMIN_DERIVED_REPORT_V1')||!approvedReportHtml.includes('mml-derived-form-editable')){
    mmlDerivedApprovalLocks.delete(lockKey);
    alert('관리자 보고서 원본을 정상적으로 저장하지 못했습니다. 보고서를 다시 열어 저장한 후 승인해 주세요.');
    return;
  }
  const snapshotText=approvedReportHtml.replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();
  const expectedText=reportSections.map(section=>String(section?.text||'').trim()).filter(Boolean).join(' ');
  if(expectedText&&snapshotText.length<Math.min(120,Math.floor(expectedText.length*.2))){
    mmlDerivedApprovalLocks.delete(lockKey);
    alert('승인 화면에 보고서 내용이 정상적으로 포함되지 않았습니다. 저장 후 다시 승인해 주세요.');
    return;
  }
  const canonicalApprovedSections=[
    ...reportSections.map(section=>({...section,text:String(section?.text||'')})),
    ...((Array.isArray(report.sections)?report.sections:[]).filter(section=>section?.key==='disclaimer').map(section=>({...section})))
  ];
  rows[idx]={
    ...report,
    reservationId,
    sections:canonicalApprovedSections,
    status:'approved',
    reviewStatus:'approved',
    approved:true,
    reviewed:true,
    approvedForClient:true,
    approvedReportHtml,
    approvedReportHtmlVersion:Number(report.version||1),
    approvedAt:now,
    approvedBy:'관리자',
    publishedAt:now,
    approvalUpdatedAt:now,
    updatedAt:now
  };
  saveDerivedAssessmentReports(rows);
  let publicReports=[];
  // 홈페이지 마음기록은 modumam_reports를 읽으므로 동일 저장소에 공개본을 저장합니다.
  try{publicReports=JSON.parse(localStorage.getItem('modumam_reports')||'[]')||[]}catch(e){publicReports=[]}
  const publicItem={
    id:Number(report.publicReportId||Date.now()),
    derivedReportId:report.id,
    sourceIntegratedReportId:report.sourceIntegratedReportId,
    reservationId,
    assessmentReport:true,
    reportKind:'client-derived-summary',
    title:'심리검사 종합보고서',
    testType:'심리검사 종합보고서',
    clientName:report.clientName||source.clientName||'',
    phone:report.phone||source.phone||'',
    program:report.program||source.program||'',
    tests:report.tests||[],
    sections:Object.fromEntries(canonicalApprovedSections.map(section=>[section.key,section.text])),
    derivedSections:canonicalApprovedSections.map(section=>({key:section.key,label:section.label,text:section.text})),
    approvedReportHtml,
    approvedForClient:true,
    approvedAt:now,
    publishedAt:now,
    createdAt:report.createdAt||now,
    updatedAt:now
  };
  const oldIndex=publicReports.findIndex(x=>String(x.derivedReportId)===String(report.id));
  if(oldIndex>=0)publicItem.id=publicReports[oldIndex].id;
  saveCanonicalPublishedReport(publicItem);
  mmlDerivedApprovalLocks.delete(lockKey);
  alert('관리자 승인이 완료되어 심리검사 종합보고서를 홈페이지에서 열람할 수 있습니다.');
  render();
}
function toggleDerivedAssessmentReportApproval(id){
  const lockKey=String(id);
  if(mmlDerivedApprovalLocks.has(lockKey))return;
  const report=derivedAssessmentReportById(id);
  if(!report)return;
  if(!report.approvedForClient){publishDerivedAssessmentReport(id);return;}
  if(!confirm('승인을 취소하여 내담자 열람을 중단할까요?'))return;
  mmlDerivedApprovalLocks.add(lockKey);
  const rows=derivedAssessmentReports();
  const idx=rows.findIndex(x=>String(x.id)===String(id));
  if(idx<0){mmlDerivedApprovalLocks.delete(lockKey);return;}
  const now=new Date().toISOString();
  rows[idx]={
    ...rows[idx],
    status:'saved',
    reviewStatus:'saved',
    approved:false,
    approvedForClient:false,
    approvedReportHtml:'',
    approvedReportHtmlVersion:0,
    approvedAt:'',
    approvedBy:'',
    publishedAt:'',
    approvalUpdatedAt:now,
    updatedAt:now
  };
  saveDerivedAssessmentReports(rows);
  removeCanonicalPublishedReportByDerivedId(id);
  mmlDerivedApprovalLocks.delete(lockKey);
  alert('승인을 취소했습니다. 홈페이지에서는 더 이상 보고서를 열람할 수 없습니다.');
  render();
}
window.toggleDerivedAssessmentReportApproval=toggleDerivedAssessmentReportApproval;
function derivedReportForSource(sourceId,audience){return derivedAssessmentReports().find(x=>String(x.sourceIntegratedReportId)===String(sourceId)&&x.audience===audience)||null}


/* [FIX-20260719-ECHART-REPORT-FLOW-04]
   전자차트 심리평가: 검사별 개별보고서 목록, 종합보고서 공개관리, 상담자용 통합보고서 보기/인쇄 */
// MOD-20260720-ECHART-REPORT-PLACEMENT-V5: 심리검사 종합보고서는 초록 카드, 상담자용은 보라 카드에 분리 표시
// PATCH-20260721-ADMIN-CLIENT-APPROVAL-V64: 내담자는 신청/취소만, 관리자는 개별·종합보고서 승인/승인취소.

function openElectronicChartReport(reportId, printNow=false){
  try{
    if(window.MMLReportViewer?.open){
      return window.MMLReportViewer.open(reportId,{printImmediately:Boolean(printNow),toolbar:true});
    }
  }catch(error){
    console.warn('[MML] 전자차트 보고서 원본 열기 fallback',error);
  }
  return printReport(reportId,Boolean(printNow));
}
function openElectronicChartComprehensiveReport(reportId, printNow=false){
  const report=typeof derivedAssessmentReportById==='function'?derivedAssessmentReportById(reportId):null;
  try{
    // 승인된 종합보고서는 심리평가센터에서 캡처한 동일 HTML 원본으로
    // 화면 보기와 PDF/인쇄를 모두 처리한다.
    if(report?.approvedReportHtml&&window.MMLReportViewer?.open){
      return window.MMLReportViewer.open({
        id:report.id,
        title:report.title||'심리검사 종합보고서',
        html:report.approvedReportHtml
      },{printImmediately:Boolean(printNow),toolbar:true});
    }
  }catch(error){
    console.warn('[MML] 종합보고서 승인 원본 열기 fallback',error);
  }
  // 승인 전 보고서는 심리평가센터의 현재 작성 폼을 그대로 연다.
  return previewDerivedAssessmentReport(reportId,Boolean(printNow));
}
window.openElectronicChartReport=openElectronicChartReport;
window.openElectronicChartComprehensiveReport=openElectronicChartComprehensiveReport;

function memberAssessmentSection(c){
  /* [MML-20260725-ECHART-VIEW-ONLY-PDF]
     전자차트는 보고서 조회 전용입니다.
     생성·수정·승인·승인취소는 심리평가센터에서만 처리합니다. */
  const clinicalRecords=window.MMLClinicalAssessmentStore
    ? window.MMLClinicalAssessmentStore.recordsForClient(c.name,c.phone)
    : [];
  const recordAnalyses=clinicalRecords.flatMap(record=>(record.tests||[]).map(test=>({...test,reservationId:test.reservationId||record.reservationId})));
  const analyses=recordAnalyses.length
    ? recordAnalyses
    : (state.assessmentAnalyses||[]).filter(a=>String(a.clientName||'').trim()===String(c.name||'').trim() || (a.phone&&clientKey('',a.phone)===c.key));
  const clinicalReports=clinicalRecords.flatMap(record=>record.issuedReports||[]);
  const reportMap=new Map();
  [...clinicalReports,...(c.reports||[])].forEach(report=>{
    if(!report)return;
    const key=String(report.id||`${report.reservationId}-${report.testType}-${report.title}`);
    reportMap.set(key,report);
  });
  const reports=[...reportMap.values()].filter(r=>r.integratedAssessmentReport||r.assessmentReport||r.individualAssessmentReport||String(r.title||'').includes('심리보고서'));
  // 전자차트는 심리평가센터에서 승인 완료된 고정본만 조회합니다.
  // 초안·승인대기·수정 중 보고서는 전자차트에 노출하지 않습니다.
  const approvedOnly=report=>Boolean(
    report?.approved===true &&
    report?.approvedForClient===true &&
    (report?.approvedReportHtml || report?.approvedSnapshot?.html || report?.approvedSnapshot?.documentHtml)
  );
  const individualReports=reports
    .filter(r=>r.individualAssessmentReport && approvedOnly(r))
    .sort((a,b)=>timelineDateValue(b.updatedAt||b.createdAt)-timelineDateValue(a.updatedAt||a.createdAt));
  const integratedReports=reports
    .filter(r=>r.integratedAssessmentReport)
    .sort((a,b)=>timelineDateValue(b.updatedAt||b.createdAt)-timelineDateValue(a.updatedAt||a.createdAt));
  const derivedRows=typeof derivedAssessmentReports==='function'?derivedAssessmentReports():[];
  const comprehensiveReports=derivedRows
    .filter(r=>r.audience==='client' && approvedOnly(r) && (String(r.clientName||'').trim()===String(c.name||'').trim() || (r.phone&&clientKey('',r.phone)===c.key)))
    .sort((a,b)=>timelineDateValue(b.updatedAt||b.createdAt)-timelineDateValue(a.updatedAt||a.createdAt));

  const individualHtml=individualReports.length
    ? individualReports.map(report=>`<div class="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div class="flex flex-wrap items-center gap-2"><p class="text-sm font-extrabold text-emerald-950">${esc(assessmentTestLabel(report.testType))} 개별 심리검사 보고서</p><span class="rounded-full px-2.5 py-1 text-[10px] font-extrabold bg-emerald-100 text-emerald-700">승인완료 · 사용자 열람가능</span></div><p class="mt-1 text-[11px] text-emerald-700">${esc(report.updatedAt||report.createdAt||'저장일 미기록')}</p></div><div class="flex flex-wrap gap-2"><button onclick="openElectronicChartReport(${JSON.stringify(report.id)},false)" class="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-extrabold text-emerald-800">보고서 보기</button><button onclick="openElectronicChartReport(${JSON.stringify(report.id)},true)" class="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-extrabold text-white">PDF/인쇄</button></div></div></div>`).join('')
    : '<p class="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4 text-xs text-emerald-700">승인 완료된 개별 심리검사 보고서가 없습니다.</p>';

  const comprehensiveHtml=comprehensiveReports.length
    ? comprehensiveReports.map(report=>`<div class="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div class="flex flex-wrap items-center gap-2"><p class="text-sm font-extrabold text-indigo-950">심리검사 종합보고서</p><span class="rounded-full px-2.5 py-1 text-[10px] font-extrabold bg-emerald-100 text-emerald-700">승인완료 · 사용자 열람가능</span></div><p class="mt-1 text-[11px] text-indigo-700">v${Number(report.version||1)} · ${esc(report.updatedAt||report.createdAt||'저장일 미기록')}</p></div><div class="flex flex-wrap gap-2"><button onclick="openElectronicChartComprehensiveReport(${JSON.stringify(report.id)},false)" class="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-xs font-extrabold text-indigo-800">종합보고서 보기</button><button onclick="openElectronicChartComprehensiveReport(${JSON.stringify(report.id)},true)" class="rounded-xl bg-indigo-700 px-4 py-2 text-xs font-extrabold text-white">PDF/인쇄</button></div></div></div>`).join('')
    : '<p class="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4 text-xs text-indigo-700">승인 완료된 심리검사 종합보고서가 없습니다.</p>';

  const masterHtml=integratedReports.length
    ? integratedReports.map(report=>`<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p class="text-sm font-extrabold text-slate-900">AI 종합해석보고서</p><p class="mt-1 text-[11px] text-slate-500">${esc(report.updatedAt||report.createdAt||'저장일 미기록')} · 상담자 검토용 원본</p></div><button onclick="printReport(${JSON.stringify(report.id)},false)" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700">원본 보기</button></div></div>`).join('')
    : '';

  return `<section class="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm sm:p-6"><div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p class="text-xs font-extrabold text-emerald-600">PSYCHOLOGICAL ASSESSMENT</p><h3 class="mt-1 text-lg font-extrabold">심리평가 보고서</h3><p class="mt-1 text-xs text-slate-500">전자차트에서는 보고서만 조회합니다. 생성·수정·승인은 심리평가센터에서 관리합니다.</p></div><button onclick="setMenu('interpretation')" class="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-extrabold text-emerald-700">심리평가센터 바로가기</button></div><div class="space-y-5"><div><div class="mb-3 flex items-center justify-between"><h4 class="text-sm font-extrabold text-emerald-950">개별 심리검사 보고서</h4><span class="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">${individualReports.length}건</span></div><div class="space-y-3">${individualHtml}</div></div><div><div class="mb-3 flex items-center justify-between"><h4 class="text-sm font-extrabold text-indigo-950">심리검사 종합보고서</h4><span class="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold text-indigo-700">${comprehensiveReports.length}건</span></div><div class="space-y-3">${comprehensiveHtml}</div></div></div></section>`;
}
