#!/bin/bash

set -Eeuo pipefail

# 始终以脚本所在目录作为工作目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}" || exit 1

# 部署目标属于运行环境，不纳入开源仓库配置。
DEPLOY_TARGET="${DEPLOY_TARGET:-}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"
DEPLOY_REQUIRED_REF="${DEPLOY_REQUIRED_REF:-}"
DEPLOY_ARTIFACT_DIR=""

cleanup() {
    if [ -n "${DEPLOY_ARTIFACT_DIR}" ]; then
        rm -rf "${DEPLOY_ARTIFACT_DIR}"
    fi
}

trap cleanup EXIT

# ==========================================
# 下面通常不需要修改
# ==========================================

print_help() {
    cat <<'EOF'
用法: ./run.sh <command>

可用命令:
  deploy [--gen] [git-ref]
                 从 Git 提交生成临时产物并部署（默认 git-ref: HEAD）
                 --gen 仅在临时产物中重新生成 posts/posts.json
  gen           扫描 posts/*.md 生成文章清单 posts/posts.json
  test [port]   启动本地测试服务器 (默认端口: 8080)
  help          显示帮助信息

deploy 环境变量:
  DEPLOY_TARGET       rsync 目标，必填，例如 user@example.com:/srv/www/blog/
  PUBLIC_BASE_URL     部署后的公开地址，必填，例如 https://blog.example.com
  DEPLOY_REQUIRED_REF 可选；设置后要求 git-ref 位于该引用历史中
EOF
}

do_gen() {
    local root_dir="${1:-${SCRIPT_DIR}}"
    root_dir="$(cd "${root_dir}" && pwd)"

    local posts_dir="${root_dir}/posts"
    local output="${posts_dir}/posts.json"
    local tmp_file
    tmp_file=$(mktemp)

    # 检查 posts 目录是否存在
    if [ ! -d "${posts_dir}" ]; then
        echo "❌ ${posts_dir} 目录不存在"
        exit 1
    fi

    # 扫描每个 .md 文件，解析 Front Matter 输出为 TAB 分隔的中间格式
    local found=0
    local md_file=""
    local public_file=""
    for md_file in "${posts_dir}"/*.md; do
        [ -f "${md_file}" ] || continue
        found=1
        public_file="posts/$(basename "${md_file}")"

        awk -v public_file="${public_file}" '
        BEGIN { in_fm=0; fm_count=0; title=""; date=""; tag=""; summary=""; cover=""; coverFit=""; publish="true"; body="" }

        /^---[[:space:]]*$/ {
            fm_count++
            if (fm_count == 1) in_fm = 1
            if (fm_count == 2) in_fm = 0
            next
        }

        in_fm {
            if (/^title:/) { sub(/^title:[[:space:]]*/, ""); title = $0 }
            else if (/^date:/) { sub(/^date:[[:space:]]*/, ""); date = $0 }
            else if (/^tag:/) { sub(/^tag:[[:space:]]*/, ""); tag = $0 }
            else if (/^summary:/) { sub(/^summary:[[:space:]]*/, ""); summary = $0 }
            else if (/^cover:/) { sub(/^cover:[[:space:]]*/, ""); cover = $0 }
            else if (/^coverFit:/) { sub(/^coverFit:[[:space:]]*/, ""); coverFit = $0 }
            else if (/^publish:/) { sub(/^publish:[[:space:]]*/, ""); publish = $0 }
            next
        }

        # 提取正文首段作为备用摘要（跳过标题和空行）
        fm_count >= 2 && body == "" {
            if (/^#/ || /^[[:space:]]*$/ || /^---/ || /^===/) next
            line = $0
            gsub(/[*_`\[\]()]/, "", line)
            gsub(/^[[:space:]]+/, "", line)
            gsub(/[[:space:]]+$/, "", line)
            if (line != "") body = line
        }

        END {
            p = tolower(publish)
            if (p == "false" || p == "0" || p == "no") exit
            if (summary == "" && body != "") summary = substr(body, 1, 100)
            # 转义 JSON 特殊字符
            gsub(/\\/, "\\\\", title);   gsub(/"/, "\\\"", title)
            gsub(/\\/, "\\\\", summary); gsub(/"/, "\\\"", summary)
            gsub(/\\/, "\\\\", tag);     gsub(/"/, "\\\"", tag)
            gsub(/\\/, "\\\\", cover);   gsub(/"/, "\\\"", cover)
            gsub(/\\/, "\\\\", coverFit); gsub(/"/, "\\\"", coverFit)
            printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n", date, title, tag, summary, cover, coverFit, public_file
        }
        ' "${md_file}" >> "${tmp_file}"
    done

    if [ "${found}" -eq 0 ]; then
        echo "[]" > "${output}"
        echo "⚠️  未找到任何 .md 文件，已生成空清单"
        rm -f "${tmp_file}"
        return
    fi

    # 按日期倒序排列，格式化为 JSON
    sort -t$'\t' -k1 -r "${tmp_file}" | awk -F'\t' '
    BEGIN { print "["; first = 1 }
    {
        if (!first) print ","
        first = 0
        print "  {"
        printf "    \"file\": \"%s\",\n", $7
        printf "    \"title\": \"%s\",\n", $2
        printf "    \"date\": \"%s\",\n", $1
        printf "    \"tag\": \"%s\",\n", $3
        printf "    \"summary\": \"%s\",\n", $4
        if ($6 != "") {
            printf "    \"cover\": \"%s\",\n", $5
            printf "    \"coverFit\": \"%s\"\n", $6
        } else {
            printf "    \"cover\": \"%s\"\n", $5
        }
        printf "  }"
    }
    END { print "\n]" }
    ' > "${output}"

    rm -f "${tmp_file}"
    local count
    count=$(grep -c '"file"' "${output}" 2>/dev/null || true)
    echo "✅ 已生成 ${output}（共 ${count} 篇文章）"
}

require_command() {
    local command_name="$1"
    if ! command -v "${command_name}" >/dev/null 2>&1; then
        echo "❌ 缺少部署依赖: ${command_name}"
        return 1
    fi
}

require_deploy_config() {
    local missing=0

    if [ -z "${DEPLOY_TARGET}" ]; then
        echo "❌ 缺少环境变量: DEPLOY_TARGET"
        missing=1
    fi
    if [ -z "${PUBLIC_BASE_URL}" ]; then
        echo "❌ 缺少环境变量: PUBLIC_BASE_URL"
        missing=1
    fi
    if [ "${missing}" -ne 0 ]; then
        echo "部署目标属于运行环境配置，不应写入仓库。"
        return 1
    fi

    case "${PUBLIC_BASE_URL}" in
        http://*|https://*)
            ;;
        *)
            echo "❌ PUBLIC_BASE_URL 必须以 http:// 或 https:// 开头"
            return 1
            ;;
    esac

    PUBLIC_BASE_URL="${PUBLIC_BASE_URL%/}"
}

write_deploy_marker() {
    local artifact_dir="$1"
    local commit_sha="$2"
    local requested_ref="$3"
    local generated_at
    generated_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    python3 - "${artifact_dir}/deploy-version.json" "${commit_sha}" "${requested_ref}" "${generated_at}" <<'PY'
import json
import sys

output, commit, requested_ref, generated_at = sys.argv[1:]
with open(output, "w", encoding="utf-8") as fp:
    json.dump(
        {
            "schema": 1,
            "commit": commit,
            "ref": requested_ref,
            "generated_at": generated_at,
        },
        fp,
        ensure_ascii=False,
        indent=2,
    )
    fp.write("\n")
PY
}

validate_artifact() {
    local artifact_dir="$1"
    local required_file=""
    local json_file=""
    local private_path=""

    for required_file in \
        index.html \
        studio.html \
        css/style.css \
        css/studio.css \
        css/studio-apps.css \
        js/script.js \
        js/studio.js \
        js/studio-apps.js \
        js/studio-guest.js \
        posts/posts.json \
        manifest.webmanifest \
        deploy-version.json; do
        if [ ! -f "${artifact_dir}/${required_file}" ]; then
            echo "❌ 发布产物缺少文件: ${required_file}"
            return 1
        fi
    done

    for json_file in \
        activity.json \
        posts/posts.json \
        manifest.webmanifest \
        deploy-version.json; do
        python3 -m json.tool "${artifact_dir}/${json_file}" >/dev/null
    done

    if command -v node >/dev/null 2>&1; then
        node --check "${artifact_dir}/js/script.js"
        node --check "${artifact_dir}/js/studio.js"
        node --check "${artifact_dir}/js/studio-apps.js"
        node --check "${artifact_dir}/js/studio-guest.js"
    fi

    for private_path in .git run.sh deploy server agents tests tmp build .venv; do
        if [ -e "${artifact_dir}/${private_path}" ]; then
            echo "❌ 发布产物包含仅供开发或运维使用的文件: ${private_path}"
            return 1
        fi
    done

    if find "${artifact_dir}" \( -name '.cursor' -o -name 'README.md' -o -name '*.test.js' -o -name '.env*' -o -name '*.sqlite3*' -o -name 'testkey.txt' \) -print -quit | grep -q .; then
        echo "❌ 发布产物包含嵌套开发文件"
        return 1
    fi

    echo "✅ 发布产物校验通过"
}

smoke_test() {
    local expected_sha="$1"
    local marker=""
    local remote_sha=""
    local route=""
    local curl_args=(
        --retry 3
        --retry-all-errors
        --connect-timeout 10
        --max-time 30
        --location
        --fail
        --silent
        --show-error
    )

    marker=$(curl "${curl_args[@]}" "${PUBLIC_BASE_URL}/deploy-version.json?verify=${expected_sha}")
    remote_sha=$(printf '%s' "${marker}" | python3 -c 'import json, sys; print(json.load(sys.stdin)["commit"])')
    if [ "${remote_sha}" != "${expected_sha}" ]; then
        echo "❌ 线上版本不匹配: expected=${expected_sha}, actual=${remote_sha}"
        return 1
    fi

    for route in \
        / \
        /blog.html \
        /tool.html \
        /about.html \
        /studio.html \
        /css/style.css \
        /css/studio.css \
        /css/studio-apps.css \
        /js/script.js \
        /js/studio.js \
        /js/studio-apps.js \
        /js/studio-guest.js \
        /activity.json \
        /manifest.webmanifest; do
        curl "${curl_args[@]}" --output /dev/null "${PUBLIC_BASE_URL}${route}?verify=${expected_sha}"
    done

    echo "✅ 线上冒烟验证通过: ${expected_sha}"
}

do_deploy() {
    local run_gen=0
    local requested_ref="HEAD"
    local ref_was_set=0
    local arg=""
    for arg in "$@"; do
        case "${arg}" in
            --gen)
                run_gen=1
                ;;
            --no-gen)
                run_gen=0
                ;;
            -h|--help)
                echo "用法: ./run.sh deploy [--gen] [git-ref]"
                echo "  --gen     仅在临时发布产物中重新生成 posts/posts.json"
                echo "  git-ref   用于生成发布产物的提交或引用，默认 HEAD"
                echo "环境变量见 ./run.sh help"
                return 0
                ;;
            -* )
                echo "❌ deploy 不支持参数: ${arg}"
                echo "用法: ./run.sh deploy [--gen] [git-ref]"
                return 1
                ;;
            *)
                if [ "${ref_was_set}" -eq 1 ]; then
                    echo "❌ deploy 只能指定一个 git-ref"
                    return 1
                fi
                requested_ref="${arg}"
                ref_was_set=1
                ;;
        esac
    done

    require_deploy_config
    require_command git
    require_command tar
    require_command rsync
    require_command curl
    require_command python3

    local worktree_status
    worktree_status=$(git status --porcelain --untracked-files=normal)
    if [ -n "${worktree_status}" ]; then
        echo "❌ 工作区存在未提交改动，拒绝生产部署:"
        printf '%s\n' "${worktree_status}"
        return 1
    fi

    local commit_sha
    local short_sha
    commit_sha=$(git rev-parse --verify "${requested_ref}^{commit}")
    short_sha=$(git rev-parse --short=12 "${commit_sha}")

    if [ -n "${DEPLOY_REQUIRED_REF}" ]; then
        if ! git rev-parse --verify "${DEPLOY_REQUIRED_REF}^{commit}" >/dev/null 2>&1; then
            echo "❌ DEPLOY_REQUIRED_REF 无法解析: ${DEPLOY_REQUIRED_REF}"
            return 1
        fi
        if ! git merge-base --is-ancestor "${commit_sha}" "${DEPLOY_REQUIRED_REF}"; then
            echo "❌ 目标提交不在要求的引用历史中: ${DEPLOY_REQUIRED_REF}"
            return 1
        fi
    fi

    local artifact_dir
    artifact_dir=$(mktemp -d)
    DEPLOY_ARTIFACT_DIR="${artifact_dir}"
    chmod 0755 "${artifact_dir}"

    git archive --format=tar "${commit_sha}" | tar -xf - -C "${artifact_dir}"

    if [ "${run_gen}" -eq 1 ]; then
        echo "ℹ️  在临时发布产物中重新生成 posts/posts.json"
        do_gen "${artifact_dir}"
    fi

    write_deploy_marker "${artifact_dir}" "${commit_sha}" "${requested_ref}"
    validate_artifact "${artifact_dir}"

    echo "========================================"
    echo "正在部署 Git 产物..."
    echo "提交: ${commit_sha} (${short_sha})"
    echo "引用: ${requested_ref}"
    echo "目标: ${DEPLOY_TARGET}"
    echo "验证地址: ${PUBLIC_BASE_URL}"
    echo "========================================"

    rsync \
        -avz \
        --delay-updates \
        --delete-delay \
        --chmod=D755,F644 \
        "${artifact_dir}/" \
        "${DEPLOY_TARGET}"

    smoke_test "${commit_sha}"
    echo "✅ 部署成功: ${commit_sha}"
}

do_test() {
    local port="${1:-8080}"

    if ! command -v python3 >/dev/null 2>&1; then
        echo "❌ 未找到 python3，请先安装 Python3。"
        exit 1
    fi

    if ! [[ "${port}" =~ ^[0-9]+$ ]]; then
        echo "❌ 端口必须是数字，例如: ./run.sh test 8080"
        exit 1
    fi

    if (( port < 1 || port > 65535 )); then
        echo "❌ 端口范围应为 1-65535: ${port}"
        exit 1
    fi

    echo "========================================"
    echo "启动本地测试服务器..."
    echo "目录: $(pwd)"
    echo "访问: http://localhost:${port}"
    echo "停止: Ctrl+C"
    echo "========================================"

    python3 -m http.server "${port}" --bind 127.0.0.1
}

command="${1:-}"
if [ $# -gt 0 ]; then
    shift
fi

case "${command}" in
    deploy)
        do_deploy "$@"
        ;;
    gen)
        do_gen "$@"
        ;;
    test)
        do_test "$@"
        ;;
    help|-h|--help|"")
        print_help
        ;;
    *)
        echo "❌ 未知命令: ${command}"
        echo
        print_help
        exit 1
        ;;
esac
