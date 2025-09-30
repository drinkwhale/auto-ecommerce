/**
 * NextAuth.js 인증 설정
 *
 * 이 파일은 NextAuth.js의 핵심 설정을 담당합니다.
 * - Credentials Provider를 사용한 이메일/비밀번호 인증
 * - JWT 기반 세션 관리
 * - UserService를 통한 사용자 인증 로직 연동
 *
 * Phase 3.5: API 엔드포인트 구현 - T031
 */

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * NextAuth.js 설정 옵션
 */
export const authOptions: NextAuthOptions = {
  // 세션 전략: JWT 사용
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30일
  },

  // 인증 제공자 설정
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'user@example.com',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('이메일과 비밀번호를 입력해주세요.');
        }

        try {
          // 사용자 조회
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            throw new Error('등록되지 않은 이메일입니다.');
          }

          // 계정 상태 확인
          if (user.status !== 'ACTIVE') {
            throw new Error('비활성화된 계정입니다. 관리자에게 문의하세요.');
          }

          // 비밀번호 검증
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            throw new Error('비밀번호가 일치하지 않습니다.');
          }

          // 마지막 로그인 시간 업데이트
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          // 인증 성공 시 반환할 사용자 정보
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
          };
        } catch (error) {
          // 에러 처리
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('인증 처리 중 오류가 발생했습니다.');
        }
      },
    }),
  ],

  // JWT 콜백 - 토큰에 추가 정보 포함
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // 최초 로그인 시 사용자 정보를 토큰에 추가
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.status = user.status;
      }

      // 세션 업데이트 시 (update 함수 호출 시)
      if (trigger === 'update' && session) {
        token = { ...token, ...session };
      }

      return token;
    },

    // 세션 콜백 - 클라이언트에 전달할 세션 정보
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
      }

      return session;
    },
  },

  // 페이지 경로 설정
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
    newUser: '/auth/register',
  },

  // 디버그 모드 (개발 환경에서만 활성화)
  debug: process.env.NODE_ENV === 'development',

  // 비밀키 설정
  secret: process.env.NEXTAUTH_SECRET,
};

/**
 * NextAuth.js 타입 확장
 * - session.user에 추가 필드 포함
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      status: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
  }
}