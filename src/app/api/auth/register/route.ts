/**
 * 회원가입 API 엔드포인트
 *
 * 새로운 사용자를 등록하는 API 엔드포인트
 * - UserService를 활용한 사용자 생성 로직
 * - 입력 데이터 검증 (Zod)
 * - 비밀번호 해싱 (bcrypt)
 * - 중복 이메일 체크
 *
 * Phase 3.5: API 엔드포인트 구현 - T032
 *
 * @endpoint POST /api/auth/register
 * @body { email: string, password: string, name: string, role?: UserRole }
 * @returns { success: boolean, user?: User, error?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const prisma = new PrismaClient();

/**
 * 회원가입 요청 데이터 검증 스키마
 */
const RegisterSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력해주세요.'),
  password: z
    .string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다.')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      '비밀번호는 대소문자, 숫자, 특수문자를 포함해야 합니다.'
    ),
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다.'),
  role: z
    .enum(['ADMIN', 'SELLER', 'VIEWER'])
    .optional()
    .default('SELLER'),
  profile: z
    .object({
      phone: z.string().optional(),
      company: z.string().optional(),
      businessNumber: z.string().optional(),
    })
    .optional(),
});

/**
 * POST /api/auth/register
 * 회원가입 처리
 */
export async function POST(request: NextRequest) {
  try {
    // 요청 본문 파싱
    const body = await request.json();

    // 입력 데이터 검증
    const validationResult = RegisterSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '입력 데이터가 유효하지 않습니다.',
          details: validationResult.error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const { email, password, name, role, profile } = validationResult.data;

    // 이메일 중복 체크
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: '이미 등록된 이메일입니다.',
        },
        { status: 409 }
      );
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 기본 사용자 환경설정
    const defaultPreferences = {
      defaultMarginRate: 30,
      preferredOpenMarkets: [],
      notificationSettings: {
        email: true,
        sms: false,
        push: true,
        orderUpdates: true,
        priceAlerts: true,
      },
      language: 'KO',
      timezone: 'Asia/Seoul',
    };

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role as UserRole,
        status: 'ACTIVE',
        profile: profile || {},
        preferences: defaultPreferences,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // 활동 로그 생성
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        entityType: 'USER',
        entityId: user.id,
        action: 'CREATE',
        description: `사용자 계정 생성: ${user.email}`,
        metadata: {
          role: user.role,
          registrationIp: request.headers.get('x-forwarded-for') || 'unknown',
        },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: '회원가입이 완료되었습니다.',
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('회원가입 처리 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '회원가입 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/register
 * 회원가입 가능 여부 확인 (이메일 중복 체크)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: '이메일을 제공해주세요.',
        },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailSchema = z.string().email();
    const emailValidation = emailSchema.safeParse(email);

    if (!emailValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: '유효한 이메일 주소를 입력해주세요.',
        },
        { status: 400 }
      );
    }

    // 이메일 중복 체크
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      available: !existingUser,
      message: existingUser
        ? '이미 등록된 이메일입니다.'
        : '사용 가능한 이메일입니다.',
    });
  } catch (error) {
    console.error('이메일 중복 확인 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '이메일 확인 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}