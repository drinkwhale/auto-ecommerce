#!/bin/bash

# 파일 무결성 검증 스크립트
# 사용법: ./check-file-integrity.sh [파일경로]

FILE_PATH=${1:-"specs/001-auto-ecommerce-project/spec.md"}

echo "🔍 파일 무결성 검사: $FILE_PATH"
echo "================================"

# 1. 파일 존재 여부 확인
if [ ! -f "$FILE_PATH" ]; then
    echo "❌ 파일이 존재하지 않습니다: $FILE_PATH"
    exit 1
fi

# 2. 파일 타입 확인
FILE_TYPE=$(file "$FILE_PATH")
echo "📁 파일 타입: $FILE_TYPE"

# 3. UTF-8 인코딩 확인
if echo "$FILE_TYPE" | grep -q "UTF-8"; then
    echo "✅ UTF-8 인코딩 확인됨"
else
    echo "⚠️  UTF-8 인코딩이 아닙니다"
    echo "   → iconv를 사용하여 UTF-8로 변환을 고려해보세요"
fi

# 4. 바이너리 데이터 검사 (ASCII가 아닌 제어 문자 확인)
BINARY_CHECK=$(file "$FILE_PATH" | grep -o "data\|binary")
if [ -n "$BINARY_CHECK" ]; then
    echo "❌ 바이너리 데이터 감지됨"
    echo "   → 파일이 손상되었을 가능성이 있습니다"
else
    echo "✅ 텍스트 파일 확인됨"
fi

# 5. 손상된 UTF-8 시퀀스 검사
if python3 - "$FILE_PATH" >/dev/null 2>/tmp/_utf8_check_err <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
try:
    path.read_text(encoding='utf-8')
except UnicodeDecodeError as exc:
    raise SystemExit(str(exc))
PY
then
    echo "✅ UTF-8 시퀀스 유효함"
else
    echo "❌ 잘못된 UTF-8 시퀀스 발견"
    cat /tmp/_utf8_check_err
    echo "   → 파일 재생성이 필요할 수 있습니다"
fi
rm -f /tmp/_utf8_check_err

# 6. 파일 크기 및 행 수 확인
FILE_SIZE=$(wc -c < "$FILE_PATH")
LINE_COUNT=$(wc -l < "$FILE_PATH")
echo "📊 파일 크기: ${FILE_SIZE} bytes"
echo "📊 총 행 수: ${LINE_COUNT} lines"

# 7. 마크다운 기본 구조 확인 (spec.md 파일인 경우)
if [[ "$FILE_PATH" == *"spec.md" ]]; then
    echo ""
    echo "📝 마크다운 구조 검사:"

    # 헤더 확인
    HEADERS=$(grep -c "^#" "$FILE_PATH" 2>/dev/null || echo "0")
    echo "   - 헤더 개수: $HEADERS"

    # 필수 섹션 확인
    SECTIONS=("User Scenarios" "Requirements" "Key Entities")
    for section in "${SECTIONS[@]}"; do
        if grep -q "$section" "$FILE_PATH" 2>/dev/null; then
            echo "   ✅ '$section' 섹션 존재"
        else
            echo "   ⚠️  '$section' 섹션 없음"
        fi
    done
fi

echo ""
echo "🎯 검사 완료!"
