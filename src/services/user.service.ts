/**
 * UserService - 사용자 관리 비즈니스 로직
 *
 * 이 서비스는 사용자 생성, 조회, 수정, 삭제 및 인증 관련 핵심 비즈니스 로직을 담당합니다.
 * Phase 3.4: 서비스 계층 구현 - T023
 */

import { PrismaClient, User, UserRole, UserStatus, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Prisma 클라이언트 인스턴스
const prisma = new PrismaClient();

/**
 * 사용자 프로필 타입 정의
 */
export interface UserProfile {
  phone?: string;
  company?: string;
  businessNumber?: string;
  address?: {
    zipCode?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

/**
 * 사용자 환경설정 타입 정의
 */
export interface UserPreferences {
  defaultMarginRate: number;
  preferredOpenMarkets: string[];
  notificationSettings?: {
    email: boolean;
    sms: boolean;
    push: boolean;
    orderUpdates: boolean;
    priceAlerts: boolean;
  };
  language: 'KO' | 'EN' | 'CN' | 'JP';
  timezone?: string;
}

/**
 * 사용자 생성 입력 데이터 검증 스키마
 */
export const CreateUserSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력해주세요'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다'),
  role: z.nativeEnum(UserRole).optional(),
  profile: z.object({
    phone: z.string().optional(),
    company: z.string().optional(),
    businessNumber: z.string().optional(),
    address: z.object({
      zipCode: z.string().optional(),
      address1: z.string().optional(),
      address2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
  }).optional(),
  preferences: z.object({
    defaultMarginRate: z.number().min(0).max(10).default(0.3),
    preferredOpenMarkets: z.array(z.string()).default([]),
    notificationSettings: z.object({
      email: z.boolean().default(true),
      sms: z.boolean().default(false),
      push: z.boolean().default(true),
      orderUpdates: z.boolean().default(true),
      priceAlerts: z.boolean().default(true),
    }).optional(),
    language: z.enum(['KO', 'EN', 'CN', 'JP']).default('KO'),
    timezone: z.string().optional(),
  }).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

/**
 * 사용자 업데이트 입력 데이터 검증 스키마
 */
export const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  profile: z.object({
    phone: z.string().optional(),
    company: z.string().optional(),
    businessNumber: z.string().optional(),
    address: z.object({
      zipCode: z.string().optional(),
      address1: z.string().optional(),
      address2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
  }).optional(),
  preferences: z.object({
    defaultMarginRate: z.number().min(0).max(10).optional(),
    preferredOpenMarkets: z.array(z.string()).optional(),
    notificationSettings: z.object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      push: z.boolean().optional(),
      orderUpdates: z.boolean().optional(),
      priceAlerts: z.boolean().optional(),
    }).optional(),
    language: z.enum(['KO', 'EN', 'CN', 'JP']).optional(),
    timezone: z.string().optional(),
  }).optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

/**
 * 비밀번호 변경 입력 데이터 검증 스키마
 */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8, '새 비밀번호는 최소 8자 이상이어야 합니다'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '새 비밀번호와 확인 비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

/**
 * UserService 클래스
 */
export class UserService {
  /**
   * 새로운 사용자 생성
   *
   * @param input 사용자 생성 입력 데이터
   * @returns 생성된 사용자 객체 (비밀번호 제외)
   * @throws 이메일 중복, 유효성 검증 실패 등
   */
  async createUser(input: CreateUserInput): Promise<Omit<User, 'password'>> {
    // 입력 데이터 검증
    const validatedInput = CreateUserSchema.parse(input);

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedInput.email },
    });

    if (existingUser) {
      throw new Error('이미 존재하는 이메일 주소입니다');
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(validatedInput.password, 10);

    // 기본 환경설정 설정
    const defaultPreferences: UserPreferences = {
      defaultMarginRate: 0.3,
      preferredOpenMarkets: [],
      notificationSettings: {
        email: true,
        sms: false,
        push: true,
        orderUpdates: true,
        priceAlerts: true,
      },
      language: 'KO',
      ...validatedInput.preferences,
    };

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email: validatedInput.email,
        password: hashedPassword,
        name: validatedInput.name,
        role: validatedInput.role || UserRole.SELLER,
        status: UserStatus.ACTIVE,
        profile: validatedInput.profile ? (validatedInput.profile as Prisma.InputJsonValue) : undefined,
        preferences: defaultPreferences as Prisma.InputJsonValue,
      },
    });

    // 비밀번호 제외하고 반환
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * 사용자 ID로 조회
   *
   * @param userId 사용자 ID
   * @returns 사용자 객체 (비밀번호 제외) 또는 null
   */
  async getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * 이메일로 사용자 조회
   *
   * @param email 이메일 주소
   * @returns 사용자 객체 (비밀번호 제외) 또는 null
   */
  async getUserByEmail(email: string): Promise<Omit<User, 'password'> | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * 인증용 사용자 조회 (비밀번호 포함)
   * 내부 인증 로직에서만 사용
   *
   * @param email 이메일 주소
   * @returns 사용자 객체 (비밀번호 포함) 또는 null
   */
  async getUserForAuth(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * 전체 사용자 목록 조회 (페이지네이션)
   *
   * @param options 조회 옵션 (페이지, 제한, 필터)
   * @returns 사용자 목록과 총 개수
   */
  async getUsers(options: {
    page?: number;
    limit?: number;
    role?: UserRole;
    status?: UserStatus;
    searchQuery?: string;
  } = {}): Promise<{
    users: Omit<User, 'password'>[];
    totalCount: number;
    page: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // 필터 조건 구성
    const where: Prisma.UserWhereInput = {};

    if (options.role) {
      where.role = options.role;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.searchQuery) {
      where.OR = [
        { email: { contains: options.searchQuery, mode: 'insensitive' } },
        { name: { contains: options.searchQuery, mode: 'insensitive' } },
      ];
    }

    // 총 개수 조회
    const totalCount = await prisma.user.count({ where });

    // 사용자 목록 조회
    const users = await prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    // 비밀번호 제외
    const usersWithoutPassword = users.map(({ password, ...user }) => user);

    return {
      users: usersWithoutPassword,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  /**
   * 사용자 정보 업데이트
   *
   * @param userId 사용자 ID
   * @param input 업데이트할 데이터
   * @returns 업데이트된 사용자 객체 (비밀번호 제외)
   * @throws 사용자 없음, 유효성 검증 실패 등
   */
  async updateUser(
    userId: string,
    input: UpdateUserInput
  ): Promise<Omit<User, 'password'>> {
    // 입력 데이터 검증
    const validatedInput = UpdateUserSchema.parse(input);

    // 사용자 존재 확인
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new Error('사용자를 찾을 수 없습니다');
    }

    // 업데이트 데이터 구성
    const updateData: Prisma.UserUpdateInput = {};

    if (validatedInput.name) {
      updateData.name = validatedInput.name;
    }

    if (validatedInput.role) {
      updateData.role = validatedInput.role;
    }

    if (validatedInput.status) {
      updateData.status = validatedInput.status;
    }

    if (validatedInput.profile) {
      // 기존 프로필과 병합
      const currentProfile = (existingUser.profile as UserProfile) || {};
      updateData.profile = {
        ...currentProfile,
        ...validatedInput.profile,
      } as Prisma.InputJsonValue;
    }

    if (validatedInput.preferences) {
      // 기존 환경설정과 병합
      const currentPreferences = (existingUser.preferences as UserPreferences) || {};
      updateData.preferences = {
        ...currentPreferences,
        ...validatedInput.preferences,
      } as Prisma.InputJsonValue;
    }

    // 사용자 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // 비밀번호 제외하고 반환
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * 비밀번호 변경
   *
   * @param userId 사용자 ID
   * @param input 비밀번호 변경 입력 데이터
   * @throws 현재 비밀번호 불일치, 유효성 검증 실패 등
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    // 입력 데이터 검증
    const validatedInput = ChangePasswordSchema.parse(input);

    // 사용자 조회 (비밀번호 포함)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다');
    }

    // 현재 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(
      validatedInput.currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      throw new Error('현재 비밀번호가 일치하지 않습니다');
    }

    // 새 비밀번호 해싱
    const hashedNewPassword = await bcrypt.hash(validatedInput.newPassword, 10);

    // 비밀번호 업데이트
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });
  }

  /**
   * 비밀번호 검증
   * 인증 시 사용
   *
   * @param email 이메일 주소
   * @param password 검증할 비밀번호
   * @returns 비밀번호가 일치하면 사용자 객체 (비밀번호 제외), 그렇지 않으면 null
   */
  async verifyPassword(
    email: string,
    password: string
  ): Promise<Omit<User, 'password'> | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    // 마지막 로그인 시간 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * 사용자 삭제 (소프트 삭제 - 상태를 INACTIVE로 변경)
   *
   * @param userId 사용자 ID
   * @throws 사용자 없음
   */
  async deleteUser(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다');
    }

    // 소프트 삭제 (상태를 INACTIVE로 변경)
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.INACTIVE },
    });
  }

  /**
   * 사용자 영구 삭제 (하드 삭제)
   * 관리자 전용 - 주의해서 사용
   *
   * @param userId 사용자 ID
   * @throws 사용자 없음, 관련 데이터 존재 시 외래키 제약 위반
   */
  async permanentlyDeleteUser(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        products: true,
        orders: true,
      },
    });

    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다');
    }

    // 관련 데이터가 있는 경우 경고
    if (user.products.length > 0 || user.orders.length > 0) {
      throw new Error(
        `사용자에게 ${user.products.length}개의 상품과 ${user.orders.length}개의 주문이 있습니다. 먼저 관련 데이터를 처리해주세요.`
      );
    }

    // 하드 삭제
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * 사용자 통계 조회
   *
   * @param userId 사용자 ID
   * @returns 사용자 통계 정보
   */
  async getUserStatistics(userId: string): Promise<{
    totalProducts: number;
    activeProducts: number;
    totalOrders: number;
    totalRevenue: number;
    totalProfit: number;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        products: {
          include: {
            orders: true,
          },
        },
        orders: true,
      },
    });

    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다');
    }

    const totalProducts = user.products.length;
    const activeProducts = user.products.filter(
      (p) => p.status === 'READY' || p.status === 'REGISTERED'
    ).length;
    const totalOrders = user.orders.length;

    // 총 매출 및 수익 계산 (Order의 payment JSON에서 추출)
    let totalRevenue = 0;
    let totalProfit = 0;

    user.orders.forEach((order) => {
      const payment = order.payment as any;
      if (payment) {
        totalRevenue += payment.saleAmount || 0;
        totalProfit += payment.netProfit || 0;
      }
    });

    return {
      totalProducts,
      activeProducts,
      totalOrders,
      totalRevenue,
      totalProfit,
    };
  }

  /**
   * 사용자 활동 로그 기록
   *
   * @param userId 사용자 ID
   * @param action 수행한 동작
   * @param details 상세 정보
   */
  async logUserActivity(
    userId: string,
    action: string,
    details?: Record<string, any>
  ): Promise<void> {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        details: details as Prisma.InputJsonValue,
      },
    });
  }
}

// UserService 싱글톤 인스턴스 export
export const userService = new UserService();