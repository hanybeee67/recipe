#!/usr/bin/env python3
"""
data/에베레스트_레시피_v3.xlsx  ->  recipes/*.md  +  public/images/recipes/*.png

레시피_데이터_템플릿.md 의 스키마를 그대로 따른다.
원본 시트 1개 = 마크다운 1개. 사용법:  python3 tools/convert_xlsx.py
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl 이 필요합니다:  pip install openpyxl")

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "data" / "에베레스트_레시피_v3.xlsx"
RECIPES_DIR = ROOT / "recipes"
IMAGES_DIR = ROOT / "public" / "images" / "recipes"

# ---------------------------------------------------------------- group 매핑
GROUP_BY_CATEGORY = {
    "치킨 커리": "커리",
    "치킨 요리": "커리",
    "양고기 카레": "커리",
    "베지 카레": "커리",
    "채식 카레": "커리",
    "콩 카레": "커리",
    "새우 카레": "커리",
    "해산물 카레": "커리",
    "계란 카레": "커리",
    "탄두리 요리": "탄두리",
    "스낵": "스낵",
    "사이드 메뉴": "스낵",
    "빵류": "빵류",
    "밥류": "밥·면",
    "볶음면": "밥·면",
    "채식 볶음면": "밥·면",
    "국수 수프": "밥·면",
    "수프": "수프·샐러드",
    "샐러드": "수프·샐러드",
    "디저트": "디저트",
    "디저트/사이드": "디저트",
    "사이드/디저트": "디저트",
    "음료": "음료",
    "세트 메뉴": "세트",
}

# 메뉴판 순서. 목록·목차·PDF 모두 이 순서를 따른다.
GROUP_ORDER = [
    "커리",
    "탄두리",
    "스낵",
    "빵류",
    "밥·면",
    "수프·샐러드",
    "세트",
    "디저트",
    "음료",
]

VALID_GROUPS = set(GROUP_ORDER) | {"프렙"}

# 대분류 안에서 세부 카테고리 순서
CATEGORY_ORDER = [
    # 커리 — 치킨 → 머턴 → 야채 → 계란 → 해산물
    "치킨 커리", "치킨 요리", "양고기 카레",
    "채식 카레", "베지 카레", "콩 카레", "계란 카레",
    "새우 카레", "해산물 카레",
    "탄두리 요리",
    "스낵", "사이드 메뉴",
    "빵류",
    "밥류", "볶음면", "채식 볶음면", "국수 수프",
    "수프", "샐러드",
    "세트 메뉴",
    "디저트", "디저트/사이드", "사이드/디저트",
    "음료",
]

# 카테고리 안에서 개별 메뉴 순서. 여기 없는 메뉴는 뒤에 이름순으로 붙는다.
ITEM_ORDER = [
    # 치킨 커리
    "치킨 커리", "치킨 마살라", "치킨 티카 마살라", "치킨머커니", "버터 치킨",
    "치킨 코르마", "치킨 빈달루", "커다이 치킨", "스페셜 커리치킨", "베이비 커리",
    "진저 치킨",
    # 양고기 카레
    "머턴 커리", "머턴 마살라", "머턴 코르마", "머턴 빈달루", "머턴 도 피아자", "머턴 아차르",
    # 채식 / 베지 카레
    "퍼니르 버터 마살라", "마타 퍼니르", "커다이 퍼니르", "머라이 코프타",
    "알루 펄럭", "머쉬룸 커리", "야채 나바라탄 코르마",
    "펄럭 퍼니르", "알루 고비", "쩌나 마살라", "달 터드카", "모듬 야채 커리",
    "달 머커니", "에그 커리",
    # 새우
    "프라운커리", "프라운 칠리 커리", "해산물 빈달루",
    # 탄두리
    "탄두리치킨(반마리)", "탄두리치킨(한마리)", "치킨 티카", "치킨 멀라이 케밥",
    "치킨 시크 케밥", "치킨 탕그리 케밥", "머턴 세꾸와", "믹스 탄두리 플래터",
    # 스낵
    "모모", "졸 모모", "사모사", "스프링롤", "퍼코다", "퍼니르 퍼코다",
    "치킨 칠리", "알루덤", "드라이 파펃", "마살라 파펃", "프렌치 프라이",
    # 빵류 — 난 종류 → 굴자빵 → 알루 파라타 → 탄두리 로티
    "플레인 난", "버터 난", "갈릭 난", "치즈 난", "허니 난",
    "굴자빵", "알루 파라타", "탄두리 로티",
    # 밥류
    "바스마티 라이스", "지라 라이스", "베지 플로우", "치킨 브리아니", "머턴 브리아니",
    "자오미엔", "베지 자오미엔", "뚝파",
    # 수프 / 샐러드
    "치킨 스프", "머쉬룸 스프", "핫&사워 스프",
    "그린 샐러드", "아마 타마타라 샐러드", "탄두리 티카 샐러드",
    # 세트
    "A set (2인)", "B set (3인)", "C set (3인)",
    # 디저트
    "굴랍자문", "라스굴라", "더히", "라이따",
    # 음료
    "플레인 라씨", "딸기 라씨", "망고 라씨", "네팔 찌야", "마살라 찌야",
]

GROUP_INDEX = {g: i for i, g in enumerate(GROUP_ORDER)}
CATEGORY_INDEX = {c: i for i, c in enumerate(CATEGORY_ORDER)}
ITEM_INDEX = {n: i for i, n in enumerate(ITEM_ORDER)}


def menu_order(recipe: dict) -> int:
    """메뉴판 정렬 키. 대분류 → 세부 카테고리 → 개별 메뉴 순."""
    g = GROUP_INDEX.get(recipe["group"], len(GROUP_ORDER))
    c = CATEGORY_INDEX.get(recipe["category"], len(CATEGORY_ORDER))
    i = ITEM_INDEX.get(recipe["name"], len(ITEM_ORDER))
    return g * 1_000_000 + c * 10_000 + i

# ------------------------------------------------------- 태그 자동 도출 규칙
# 두 개의 스코프로 나눈다. 단일 음절 키워드("난", "면", "밥")를 재료명 전체에
# 부분 문자열로 매칭하면 오탐이 심하므로(예: "슬라이스" -> "라이스"),
# 주재료 태그는 재료명에서만, 조리법/형태 태그는 메뉴명·분류에서만 도출한다.

# 주재료 태그: 재료명 + 비고 에서만 탐색
INGREDIENT_TAG_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("닭고기", ("닭",)),
    ("양고기", ("머턴", "머튼", "양사태")),
    ("해산물", ("새우", "해물", "오징어", "홍합")),
    ("계란", ("계란",)),
    ("파니르", ("퍼니르", "파니르")),
    ("감자", ("감자",)),
    ("시금치", ("시금치", "펄럭")),
    ("병아리콩", ("병아리콩", "besan")),
    ("렌틸", ("달머커니", "달 머커니", "렌틸")),
    ("버섯", ("버섯",)),
    ("치즈", ("치즈", "모자렐라", "모짜렐라")),
    ("크림", ("크림",)),
    ("요거트", ("요거트", "더히")),
    ("토마토", ("토마토",)),
    ("견과", ("캐슈넛", "땅콩")),
    ("매운맛", ("청양고추", "베트남 고추", "고운 고추가루", "건고추")),
)

# 조리법/형태 태그: 메뉴명(한/영) + 카테고리 에서만 탐색
TITLE_TAG_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("매운맛", ("빈달루", "vindaloo", "칠리", "chili", "핫&사워", "hot & sour", "아차르", "achar")),
    ("마일드", ("코르마", "korma", "머커니", "makhani", "버터", "butter", "멀라이", "malai")),
    ("튀김", ("사모사", "samosa", "스프링롤", "spring roll", "퍼코다", "pakora",
              "프라이", "fries", "칠리", "chili")),
)

# 카테고리 -> 형태 태그
CATEGORY_TAG = {
    "탄두리 요리": "탄두리",
    "밥류": "밥",
    "빵류": "빵",
    "볶음면": "면",
    "채식 볶음면": "면",
    "국수 수프": "면",
    "수프": "수프",
    "샐러드": "샐러드",
    "디저트": "디저트",
    "음료": "음료",
}

# 채식 여부 판정: 재료명에 아래가 하나라도 있으면 논베지
NON_VEG = ("닭", "치킨", "머턴", "머튼", "양사태", "새우", "해물", "오징어", "홍합", "계란")

# 카테고리만으로 채식이 확정되는 경우
VEG_CATEGORIES = ("베지 카레", "채식 카레", "콩 카레", "채식 볶음면")

# ------------------------------------------------------------- 영문명 보정
#
# 원본 xlsx 의 영문 표기를 매장에서 쓰는 표기로 맞춘다.
# 여기서 고치면 재변환해도 유지된다. (id 슬러그도 이 값에서 만들어진다)
NAME_EN_OVERRIDE = {
    "Butter Chicken / Murgh Makhani": "Butter Chicken",
    "Karahi Chicken": "Kadai Chicken",
    "Karahi Paneer": "Kadai Paneer",
    "Ama Tomato Salad": "Ama & Tamatala Salad",
}

# ------------------------------------------------------------- 슬러그 생성
MANUAL_SLUG = {
    # 영문명이 없거나 모호한 시트의 고정 슬러그
    "A set (2인)": "set-menu-for-2",
    "B set (3인)": "set-menu-for-3",
    "C set (3인)": "set-menu-for-3-premium",
}


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


# ------------------------------------------------------ 시트 ↔ 임베드 이미지
def build_image_map(xlsx_path: Path) -> dict[str, str]:
    """시트명 -> zip 내부 이미지 경로(xl/media/imageN.png)"""
    ns_main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    ns_rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

    with zipfile.ZipFile(xlsx_path) as z:
        names = set(z.namelist())

        def parse(path: str):
            return ET.fromstring(z.read(path)) if path in names else None

        wb = parse("xl/workbook.xml")
        wb_rels = {r.get("Id"): r.get("Target") for r in parse("xl/_rels/workbook.xml.rels")}

        result: dict[str, str] = {}
        for sheet in wb.find(f"{{{ns_main}}}sheets"):
            sheet_name = sheet.get("name")
            target = wb_rels[sheet.get(f"{{{ns_rel}}}id")].lstrip("/")
            sheet_file = os.path.basename(target)

            sheet_rels = parse(f"xl/worksheets/_rels/{sheet_file}.rels")
            if sheet_rels is None:
                continue
            for rel in sheet_rels:
                if "drawing" not in rel.get("Type"):
                    continue
                drawing_file = os.path.basename(rel.get("Target"))
                drawing_rels = parse(f"xl/drawings/_rels/{drawing_file}.rels")
                if drawing_rels is None:
                    continue
                for r2 in drawing_rels:
                    if "image" in r2.get("Type"):
                        result[sheet_name] = "xl/media/" + os.path.basename(r2.get("Target"))
        return result


def extract_image(xlsx_path: Path, member: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(xlsx_path) as z, z.open(member) as src, open(dest, "wb") as out:
        shutil.copyfileobj(src, out)


# ------------------------------------------------- 원본에 사진이 없는 메뉴 보완
#
# 원본 xlsx 87시트 중 4개(허니 난, A/B/C set)에는 그림이 들어있지 않다.
# 원본 자체가 유사 메뉴끼리 사진을 공유하므로(치킨/머턴/에그 커리가 한 장을
# 같이 씀) 난 종류는 같은 방식으로 채우고, 어디서 온 사진인지 imageNote 에
# 남긴다. 세트 메뉴(A/B/C set)는 대표 사진을 만들지 않고 비워 둔다.

# 대체: 레시피 id -> (가져올 레시피 id, 설명)
IMAGE_SUBSTITUTE = {
    "honey-naan": ("plain-naan", "플레인 난 사진 (원본에 허니 난 사진 없음)"),
}


def build_missing_images(images_dir: Path) -> dict[str, tuple[str, str]]:
    """대체 이미지를 만들고 {id: (경로, 설명)} 을 돌려준다."""
    made: dict[str, tuple[str, str]] = {}

    for rid, (source_id, note) in IMAGE_SUBSTITUTE.items():
        src = images_dir / f"{source_id}.png"
        if not src.exists():
            continue
        dest = images_dir / f"{rid}.png"
        shutil.copyfile(src, dest)
        made[rid] = (f"images/recipes/{dest.name}", note)

    return made


# ------------------------------------------------------------------ 시트 파싱
def clean(value) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("‍", "‍")).strip()


def parse_sheet(ws) -> dict:
    name = clean(ws["B2"].value)
    serving = clean(ws["G2"].value) or "1인분 기준"

    raw_b3 = clean(ws["B3"].value).lstrip("📂").strip()
    m = re.match(r"^(.*?)\s*\((.+)\)$", raw_b3)
    if m:
        category, name_en = m.group(1).strip(), m.group(2).strip()
    else:
        category, name_en = raw_b3, ""
    name_en = NAME_EN_OVERRIDE.get(name_en, name_en)

    raw_b4 = clean(ws["B4"].value)
    cook_time = raw_b4.split(":", 1)[1].strip() if ":" in raw_b4 else raw_b4
    nums = [int(n) for n in re.findall(r"\d+", cook_time)]
    cook_min = nums[0] if nums else 0
    cook_max = nums[-1] if nums else cook_min

    # --- 재료: D열이 정수인 행
    ingredients = []
    for row in range(7, ws.max_row + 1):
        no = ws.cell(row=row, column=4).value  # D
        if not isinstance(no, (int, float)):
            if ingredients:
                break
            continue
        ingredients.append(
            {
                "no": int(no),
                "name": clean(ws.cell(row=row, column=5).value),  # E
                "amount": clean(ws.cell(row=row, column=6).value),  # F
                "note": clean(ws.cell(row=row, column=7).value),  # G
            }
        )

    # --- B열 스캔: 조리 방법 / 가니쉬
    steps: list[str] = []
    garnish = ""
    mode = None
    for row in range(5, ws.max_row + 1):
        text = clean(ws.cell(row=row, column=2).value)  # B
        if not text:
            continue
        if "조리 방법" in text:
            mode = "steps"
            continue
        if "가니쉬" in text:
            mode = "garnish"
            continue
        if "Recipe Card" in text or "Everest Restaurant Group" in text:
            mode = None
            continue
        if mode == "steps":
            steps.append(re.sub(r"^\d+\.\s*", "", text))
        elif mode == "garnish" and not garnish:
            garnish = text

    return {
        "name": name,
        "nameEn": name_en,
        "category": category,
        "serving": serving,
        "cookTime": cook_time,
        "cookTimeMin": cook_min,
        "cookTimeMax": cook_max,
        "ingredients": ingredients,
        "steps": steps,
        "garnish": garnish,
    }


def derive_tags(recipe: dict) -> list[str]:
    ing_text = " ".join(
        [i["name"] for i in recipe["ingredients"]] + [i["note"] for i in recipe["ingredients"]]
    ).lower()
    title_text = " ".join([recipe["name"], recipe["nameEn"], recipe["category"]]).lower()

    tags: list[str] = []

    def add(tag: str) -> None:
        if tag not in tags:
            tags.append(tag)

    for tag, keywords in INGREDIENT_TAG_RULES:
        if any(k.lower() in ing_text for k in keywords):
            add(tag)

    for tag, keywords in TITLE_TAG_RULES:
        if any(k.lower() in title_text for k in keywords):
            add(tag)

    shape = CATEGORY_TAG.get(recipe["category"])
    if shape:
        add(shape)

    if recipe["category"] in VEG_CATEGORIES or not any(k in ing_text for k in NON_VEG):
        add("채식")

    return tags


# ------------------------------------------------------------- 마크다운 출력
def yaml_str(value: str) -> str:
    """YAML 스칼라를 안전하게 인용."""
    if value == "":
        return '""'
    if re.search(r'[:#\-\[\]{}&*!|>%@`"\',]|^\s|\s$', value):
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return value


def md_cell(value: str) -> str:
    return value.replace("|", "\\|")


def render_markdown(r: dict) -> str:
    fm = [
        "---",
        f"id: {r['id']}",
        f"name: {yaml_str(r['name'])}",
        f"nameEn: {yaml_str(r['nameEn'])}",
        f"category: {yaml_str(r['category'])}",
        f"group: {yaml_str(r['group'])}",
        f"serving: {yaml_str(r['serving'])}",
        f"cookTime: {yaml_str(r['cookTime'])}",
        f"cookTimeMin: {r['cookTimeMin']}",
        f"cookTimeMax: {r['cookTimeMax']}",
        f"image: {yaml_str(r['image']) if r['image'] else 'null'}",
        f"imageNote: {yaml_str(r['imageNote']) if r.get('imageNote') else 'null'}",
        f"order: {r['order']}",
        f"ingredientCount: {len(r['ingredients'])}",
        f"stepCount: {len(r['steps'])}",
        "tags:" if r["tags"] else "tags: []",
    ]
    for tag in r["tags"]:
        fm.append(f"  - {yaml_str(tag)}")
    fm.append("---")

    body = ["", "## 재료", "", "| # | 재료명 | 수량 | 비고 |", "|---:|---|---|---|"]
    for ing in r["ingredients"]:
        body.append(
            f"| {ing['no']} | {md_cell(ing['name'])} | {md_cell(ing['amount'])} | {md_cell(ing['note'])} |"
        )

    body += ["", "## 조리 방법", ""]
    for idx, step in enumerate(r["steps"], start=1):
        body.append(f"{idx}. {step}")

    if r["garnish"]:
        body += ["", "## 가니쉬", "", r["garnish"]]

    body.append("")
    return "\n".join(fm) + "\n" + "\n".join(body)


# ----------------------------------------------------------------------- main
def main() -> int:
    if not XLSX.exists():
        sys.exit(f"원본을 찾을 수 없습니다: {XLSX}")

    print(f"원본: {XLSX.name}")
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    image_map = build_image_map(XLSX)

    if RECIPES_DIR.exists():
        # prep-*.md 는 tools/convert_prep.py 가 관리하므로 건드리지 않는다
        for stale in RECIPES_DIR.glob("*.md"):
            if not stale.name.startswith("prep-"):
                stale.unlink()
    RECIPES_DIR.mkdir(parents=True, exist_ok=True)

    if IMAGES_DIR.exists():
        shutil.rmtree(IMAGES_DIR)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    used_ids: set[str] = set()
    results: list[dict] = []
    warnings: list[str] = []

    for ws in wb.worksheets:
        r = parse_sheet(ws)

        # id
        base = MANUAL_SLUG.get(ws.title) or slugify(r["nameEn"]) or slugify(ws.title)
        if not base:
            base = f"recipe-{len(results) + 1}"
        rid, n = base, 2
        while rid in used_ids:
            rid, n = f"{base}-{n}", n + 1
        used_ids.add(rid)
        r["id"] = rid

        # group
        group = GROUP_BY_CATEGORY.get(r["category"])
        if group is None:
            warnings.append(f"[group 미매핑] {ws.title} / category={r['category']!r} -> '스낵'")
            group = "스낵"
        r["group"] = group

        # image
        member = image_map.get(ws.title)
        if member:
            ext = os.path.splitext(member)[1] or ".png"
            dest = IMAGES_DIR / f"{rid}{ext}"
            extract_image(XLSX, member, dest)
            r["image"] = f"images/recipes/{dest.name}"
        else:
            r["image"] = None

        r["imageNote"] = None
        r["tags"] = derive_tags(r)
        r["order"] = menu_order(r)

        # 무결성 점검
        if not r["ingredients"]:
            warnings.append(f"[재료 0건] {ws.title}")
        if not r["steps"]:
            warnings.append(f"[조리단계 0건] {ws.title}")
        if r["group"] not in VALID_GROUPS:
            warnings.append(f"[group 값 오류] {ws.title} -> {r['group']}")
        if r["category"] not in CATEGORY_INDEX:
            warnings.append(f"[카테고리 순서 미지정] {ws.title} -> {r['category']}")
        if r["name"] not in ITEM_INDEX:
            warnings.append(f"[메뉴 순서 미지정] {ws.title}")

        results.append(r)

    # 원본에 사진이 없는 메뉴를 대체·합성으로 채운다 (모든 원본 추출 후 실행)
    from_source = sum(1 for r in results if r["image"])
    filled = build_missing_images(IMAGES_DIR)
    for r in results:
        if r["image"] is None and r["id"] in filled:
            r["image"], r["imageNote"] = filled[r["id"]]

    for r in results:
        if r["image"] is None:
            warnings.append(f"[사진 없음] {r['name']}")
        (RECIPES_DIR / f"{r['id']}.md").write_text(render_markdown(r), encoding="utf-8")

    print(f"레시피 {len(results)}개 -> {RECIPES_DIR.relative_to(ROOT)}/")
    print(
        f"사진 {sum(1 for r in results if r['image'])}개 "
        f"(원본 {from_source} + 보완 {len(filled)}) -> {IMAGES_DIR.relative_to(ROOT)}/"
    )

    groups: dict[str, int] = {}
    for r in results:
        groups[r["group"]] = groups.get(r["group"], 0) + 1
    print("대분류:", json.dumps({g: groups.get(g, 0) for g in GROUP_ORDER}, ensure_ascii=False))

    if warnings:
        print(f"\n경고 {len(warnings)}건")
        for w in warnings:
            print("  -", w)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
