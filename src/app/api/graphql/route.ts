/**
 * GraphQL API 엔드포인트
 *
 * Apollo Server를 사용한 GraphQL API
 * - 스키마 및 리졸버 통합
 * - NextAuth 세션 컨텍스트 통합
 * - 에러 처리
 *
 * Phase 3.5: API 엔드포인트 구현 - T043
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLError, graphql, parse, validate } from 'graphql';
import { typeDefs } from '@/lib/graphql/schema';
import { resolvers } from '@/lib/graphql/resolvers';
import { logger } from '@/lib/logger';

// GraphQL 스키마 생성
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

/**
 * POST /api/graphql
 * GraphQL 쿼리 실행
 */
export async function POST(request: NextRequest) {
  const requestId =
    request.headers.get('x-request-id') || request.headers.get('x-trace-id') || undefined;

  return logger.withContext(
    {
      requestId,
      source: 'api/graphql',
      metadata: {
        method: 'POST',
        path: '/api/graphql',
      },
    },
    async () => {
      try {
        // 세션 조회
        const session = await getServerSession(authOptions);

        // 요청 본문 파싱
        const body = await request.json();
        const { query, variables, operationName } = body;

        if (operationName) {
          logger.debug('GraphQL request received', {
            operationName,
          });
        }

        if (!query) {
          logger.warn('GraphQL request rejected: missing query');

          return new Response(
            JSON.stringify({
              errors: [{ message: 'Query가 필요합니다.' }],
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // 쿼리 검증
        const documentAST = parse(query);
        const validationErrors = validate(schema, documentAST);

        if (validationErrors.length > 0) {
          logger.warn('GraphQL validation failed', {
            errorCount: validationErrors.length,
          });

          return new Response(
            JSON.stringify({
              errors: validationErrors.map((err) => ({
                message: err.message,
                locations: err.locations,
                path: err.path,
              })),
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // GraphQL 실행
        const result = await graphql({
          schema,
          source: query,
          variableValues: variables,
          operationName,
          contextValue: {
            session,
            request,
          },
        });

        // 에러 포맷팅
        if (result.errors) {
          const formattedErrors = result.errors.map((error) => {
            if (error instanceof GraphQLError) {
              return {
                message: error.message,
                locations: error.locations,
                path: error.path,
                extensions: error.extensions,
              };
            }
            return {
              message: error.message,
            };
          });

          logger.error('GraphQL execution returned errors', {
            errorCount: formattedErrors.length,
          });

          return new Response(
            JSON.stringify({
              data: result.data,
              errors: formattedErrors,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // 성공 응답
        logger.info('GraphQL execution succeeded', {
          hasData: Boolean(result.data),
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('GraphQL execution failed', { error });

        return new Response(
          JSON.stringify({
            errors: [
              {
                message: 'GraphQL 실행 중 오류가 발생했습니다.',
                extensions: {
                  code: 'INTERNAL_SERVER_ERROR',
                  details: error instanceof Error ? error.message : 'Unknown error',
                },
              },
            ],
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }
  );
}

/**
 * GET /api/graphql
 * GraphQL Playground (개발 환경에서만)
 */
export async function GET(_request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not Found', { status: 404 });
  }

  // GraphQL Playground HTML
  const playgroundHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GraphQL Playground</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .header {
      background: #1a1a1a;
      color: white;
      padding: 16px;
      font-size: 18px;
      font-weight: bold;
    }
    .content {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 20px;
      background: #f5f5f5;
    }
    textarea {
      width: 100%;
      height: 200px;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    button {
      background: #0070f3;
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 12px;
    }
    button:hover {
      background: #0051cc;
    }
    .result {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 12px;
      min-height: 200px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">GraphQL Playground - Auto E-commerce API</div>
    <div class="content">
      <textarea id="query" placeholder="Enter your GraphQL query here...">
query {
  me {
    id
    email
    name
    role
  }
}</textarea>
      <button onclick="executeQuery()">Execute Query</button>
      <div class="result" id="result">결과가 여기에 표시됩니다...</div>
    </div>
  </div>
  <script>
    async function executeQuery() {
      const query = document.getElementById('query').value;
      const resultEl = document.getElementById('result');

      try {
        resultEl.textContent = 'Loading...';

        const response = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });

        const result = await response.json();
        resultEl.textContent = JSON.stringify(result, null, 2);
      } catch (error) {
        resultEl.textContent = 'Error: ' + error.message;
      }
    }
  </script>
</body>
</html>
  `;

  return new Response(playgroundHTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
