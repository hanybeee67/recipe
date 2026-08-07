# 에베레스트 레시피북

Everest Restaurant Group 주방용 레시피북 웹앱.
네팔·인도 요리 **87개 메뉴**의 재료·계량·조리 순서를 폰/태블릿/PC에서 바로 보고 인쇄한다.

- 기획: [`레시피북_앱_기획서.md`](./레시피북_앱_기획서.md)
- 데이터 스키마: [`레시피_데이터_템플릿.md`](./레시피_데이터_템플릿.md)

---

## 빠르게 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

`dev` / `build` 는 실행 전 `recipes/*.md` 를 검증하고 `src/data/recipes.json` 을 자동 생성한다.

```bash
npm run build      # 타입 검사 + 정적 빌드 -> dist/
npm run preview    # 빌드 결과 확인
```

---

## 기능

### 상세보기
- 사진 카드 그리드 → 상세 (`#/recipe/<id>`). 새로고침·뒤로가기·링크 공유 모두 동작
- 재료 표 / 조리 단계 / 가니쉬 — 원본 엑셀 내용 그대로
- **분량 배율기** `×1 ×2 ×3 ×4` — `100g` → `300g`, `10g씩` → `30g씩` 처럼 숫자+단위만 환산하고 원본 값을 함께 표시
- **조리 단계 체크** — 단계를 탭하면 완료 표시. 진행 상황은 기기에 저장되어 새로고침해도 유지
- 현재 필터 결과 안에서 이전/다음 이동 (`←` `→` 키 지원)

### 검색 / 필터
- 통합 검색: 메뉴명(한/영) · 카테고리 · 태그 · **재료명**
  - `감자` → 알루 고비, 알루덤, 사모사, 프렌치 프라이 … 감자를 쓰는 8개 레시피
- **초성 검색**: `ㅊㅋㅋㄹ` → 치킨 커리
  - 어절 시작점에서만 매칭하므로 `ㅊㅋ` 가 "야**채 커**리" 같은 어절 중간에 걸리지 않는다
- 대분류 탭 8종 + 세부 카테고리 / 조리시간 / **재료 제외**(알레르기·채식 대응) 다중 필터
- 정렬: 이름순 · 조리시간 짧은순 · 재료 적은순
- 모든 필터 상태가 URL 에 반영된다 — `#/?q=치킨&group=커리&max=5`

### PDF 내보내기
- 상세 화면에서 단일 레시피 A4 카드
- 목록에서 카드의 `＋` 로 여러 개 선택 → 한 문서로
- 2건 이상이면 **표지 + 목차** 자동 생성 (87건도 목차 1쪽에 3단 조판)
- 브라우저 인쇄 대화상자에서 `PDF로 저장` 선택
  - 한글이 이미지가 아닌 선택 가능한 벡터 텍스트로 남는다
  - 87건 전체를 내보내도 레시피가 페이지 경계에서 잘리지 않는다 (89쪽)

### 그 외
- 라이트 / 다크 / 시스템 테마 (주방 조명 대응)
- 360px ~ 1920px 반응형, 터치 타겟 44px 이상
- 데이터가 번들에 포함되므로 최초 로딩 후 네트워크 없이 동작

---

## 데이터 흐름

```
data/에베레스트_레시피_v3.xlsx   (원본, 87 시트)
        │  python3 tools/convert_xlsx.py
        ▼
recipes/*.md  +  public/images/recipes/*.png     ← 사람이 읽고 고치는 단일 진실 공급원
        │  node scripts/build-recipes.mjs  (스키마 검증)
        ▼
src/data/recipes.json                            ← 앱이 import
```

레시피를 고칠 때는 **`recipes/*.md` 만** 수정한다. 앱 코드에 데이터를 하드코딩하지 않는다.

`scripts/build-recipes.mjs` 는 아래를 검사하고 위반 시 빌드를 실패시킨다.

- `id` ↔ 파일명 일치 / `id` 유일성
- 필수 필드와 타입, `group` 이 고정 8종인지
- `ingredientCount` · `stepCount` 가 본문 실제 개수와 일치하는지
- `image` 로 지정한 파일이 `public/` 에 실제로 있는지
- 재료 표 헤더가 `# / 재료명 / 수량 / 비고` 인지

### 원본 xlsx 를 다시 받았을 때

```bash
pip install openpyxl
cp <새-파일>.xlsx data/에베레스트_레시피_v3.xlsx
python3 tools/convert_xlsx.py    # recipes/*.md 와 이미지 재생성
npm run build                    # 스키마 검증 + 빌드
```

`convert_xlsx.py` 는 `recipes/*.md` 를 **전부 지우고 다시 만든다.**
md 를 직접 손봤다면 그 수정분은 사라지므로, 원본 xlsx 를 함께 고치거나 변환 후 다시 반영해야 한다.

---

## 구조

```
data/                    원본 엑셀
tools/convert_xlsx.py    xlsx -> md + 이미지
recipes/                 레시피 87개 (md, 스키마는 레시피_데이터_템플릿.md)
public/images/recipes/   요리 사진 83장
scripts/build-recipes.mjs  md -> json + 스키마 검증
src/
  types.ts               Recipe / Filters 타입, 대분류 8종
  lib/
    hangul.ts            초성 변환
    search.ts            검색 인덱스 · 필터 · 정렬 · 하이라이트
    scale.ts             분량 배율 환산
    router.ts            해시 라우팅 + 필터 URL 직렬화
    storage.ts           테마 · 조리 단계 진행 저장
    assets.ts            자산 경로
  components/
    Header · ListView · RecipeCard · DetailView · PrintView · Highlight
  styles/
    tokens.css           색 · 간격 · 서체 토큰 (라이트/다크)
    app.css              화면 스타일
    print.css            인쇄(PDF) 레이아웃
```

---

## 알려진 제약

- 세트 메뉴 3종(A/B/C set)과 허니 난은 **원본 엑셀에 사진이 없어** 대분류 이모지 플레이스홀더로 표시된다.
- 원본이 전부 `1인분 기준` 이라 배율기는 1인분을 기준으로 환산한다.
  `적당량` 처럼 숫자가 없는 표기는 배율을 적용하지 않고 원문을 유지한다.
- PDF 는 브라우저 인쇄 기능을 사용한다. 인쇄 대화상자에서 **배경 그래픽** 을 켜야
  강조색과 표 줄무늬가 함께 출력된다.
