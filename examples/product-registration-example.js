/**
 * 오픈마켓 통합 상품 등록 예시
 *
 * 이 예시는 실제 API를 사용하여 여러 오픈마켓에 상품을 등록하는 방법을 보여줍니다.
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// API 기본 설정
const API_BASE_URL = 'http://localhost:3000/api/markets';
const CLIENT_ID = 'your-client-id'; // 실제 사용시 환경변수로 관리

/**
 * 단일 상품 등록 예시
 */
async function registerSingleProduct() {
  try {
    console.log('🚀 단일 상품 등록 시작...\n');

    const productData = {
      sku: 'EXAMPLE-001',
      name: '프리미엄 무선 이어폰',
      price: 199000,
      originalPrice: 249000,
      description: `
        최신 블루투스 5.2 기술을 적용한 프리미엄 무선 이어폰입니다.
        - 노이즈 캔슬링 기능 탑재
        - 최대 30시간 재생 시간
        - IPX7 방수 등급
        - 고해상도 오디오 지원
        - 터치 컨트롤 지원

        패키지 구성:
        - 이어폰 본체 1개
        - 충전 케이스 1개
        - USB-C 충전 케이블 1개
        - 이어팁 3종 (S, M, L)
        - 사용자 매뉴얼 1개
      `.trim(),
      brand: 'TechSound',
      manufacturer: '테크사운드코리아',
      model: 'TS-WE2024',
      stock: 100,
      categories: ['전자제품', '오디오', '이어폰', '무선이어폰'],
      images: [
        'https://example.com/images/earphone-main.jpg',
        'https://example.com/images/earphone-side.jpg',
        'https://example.com/images/earphone-case.jpg',
        'https://example.com/images/earphone-package.jpg'
      ],
      deliveryFee: 0,
      deliveryType: 'FREE',
      deliveryPeriod: '1-2일',
      taxType: 'TAX',
      adultProduct: false,
      maxBuyCount: 5,
      minBuyCount: 1,
      keywords: ['무선이어폰', '블루투스', '노이즈캔슬링', '방수', '프리미엄'],
      options: [
        {
          name: '색상',
          values: [
            { name: '블랙', additionalPrice: 0, stock: 50 },
            { name: '화이트', additionalPrice: 0, stock: 30 },
            { name: '실버', additionalPrice: 5000, stock: 20 }
          ]
        }
      ]
    };

    const platforms = ['elevenst', 'coupang', 'naver'];
    const options = {
      skipCategoryValidation: false,
      priority: 'high'
    };

    const response = await axios.post(`${API_BASE_URL}/products/register`, {
      productData,
      platforms,
      options
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': CLIENT_ID
      },
      timeout: 60000
    });

    console.log('✅ 등록 성공!');
    console.log(`작업 ID: ${response.data.data.jobId}`);
    console.log(`성공한 플랫폼 수: ${response.data.data.successCount}`);
    console.log(`실패한 플랫폼 수: ${response.data.data.failureCount}`);

    if (response.data.data.results.successful.length > 0) {
      console.log('\n📈 성공한 등록:');
      response.data.data.results.successful.forEach(result => {
        console.log(`  - ${result.platform}: ${result.productId}`);
      });
    }

    if (response.data.data.results.failed.length > 0) {
      console.log('\n❌ 실패한 등록:');
      response.data.data.results.failed.forEach(result => {
        console.log(`  - ${result.platform}: ${result.error}`);
      });
    }

    return response.data.data;

  } catch (error) {
    console.error('❌ 상품 등록 실패:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 배치 상품 등록 예시
 */
async function registerMultipleProducts() {
  try {
    console.log('🚀 배치 상품 등록 시작...\n');

    const products = [
      {
        sku: 'BATCH-001',
        name: '스마트워치 프로',
        price: 299000,
        description: '건강 모니터링과 스마트 기능을 갖춘 프리미엄 스마트워치',
        brand: 'SmartTech',
        stock: 50,
        categories: ['전자제품', '웨어러블', '스마트워치']
      },
      {
        sku: 'BATCH-002',
        name: '무선 충전패드',
        price: 49000,
        description: '고속 무선 충전을 지원하는 슬림한 충전패드',
        brand: 'ChargeTech',
        stock: 200,
        categories: ['전자제품', '충전기', '무선충전']
      },
      {
        sku: 'BATCH-003',
        name: '블루투스 스피커',
        price: 89000,
        description: '360도 사운드와 방수 기능을 갖춘 포터블 스피커',
        brand: 'SoundWave',
        stock: 75,
        categories: ['전자제품', '오디오', '스피커']
      }
    ];

    const platforms = ['elevenst', 'naver'];

    const response = await axios.post(`${API_BASE_URL}/products/batch-register`, {
      products,
      platforms
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': CLIENT_ID
      },
      timeout: 300000 // 5분
    });

    console.log('✅ 배치 등록 완료!');
    console.log(`총 상품 수: ${response.data.data.totalProducts}`);
    console.log(`성공한 상품 수: ${response.data.data.totalSuccessful}`);
    console.log(`실패한 상품 수: ${response.data.data.totalFailed}`);

    return response.data.data;

  } catch (error) {
    console.error('❌ 배치 상품 등록 실패:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 카테고리 추천 예시
 */
async function getCategoryRecommendations() {
  try {
    console.log('🔍 카테고리 추천 요청...\n');

    const response = await axios.post(`${API_BASE_URL}/categories/suggest`, {
      productName: '아이폰 15 프로 케이스',
      productDescription: '투명한 실리콘 재질로 만든 아이폰 15 프로용 보호케이스',
      existingCategories: ['휴대폰액세서리']
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': CLIENT_ID
      }
    });

    console.log('📋 카테고리 추천 결과:');
    response.data.data.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion.category.name} (신뢰도: ${Math.round(suggestion.confidence * 100)}%)`);
      console.log(`   경로: ${suggestion.category.path.join(' > ')}`);
      console.log('');
    });

    return response.data.data;

  } catch (error) {
    console.error('❌ 카테고리 추천 실패:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 주문 동기화 예시
 */
async function synchronizeOrders() {
  try {
    console.log('🔄 주문 동기화 시작...\n');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const response = await axios.post(`${API_BASE_URL}/orders/sync`, {
      startDate: sevenDaysAgo.toISOString(),
      endDate: new Date().toISOString(),
      platforms: ['elevenst', 'coupang', 'naver']
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': CLIENT_ID
      }
    });

    console.log('✅ 주문 동기화 완료!');
    console.log(`동기화 작업 ID: ${response.data.data.syncJobId}`);
    console.log(`총 주문 수: ${response.data.data.totalOrders}`);

    console.log('\n📊 플랫폼별 주문 수:');
    Object.entries(response.data.data.results).forEach(([platform, result]) => {
      if (result.success) {
        console.log(`  - ${platform}: ${result.orderCount}건`);
      } else {
        console.log(`  - ${platform}: 실패 (${result.error})`);
      }
    });

    return response.data.data;

  } catch (error) {
    console.error('❌ 주문 동기화 실패:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 재고 동기화 예시
 */
async function synchronizeInventory() {
  try {
    console.log('📦 재고 동기화 시작...\n');

    const inventoryUpdates = [
      {
        productSku: 'EXAMPLE-001',
        quantity: 85,
        platforms: ['elevenst', 'coupang', 'naver']
      },
      {
        productSku: 'BATCH-001',
        quantity: 40,
        platforms: ['elevenst', 'naver']
      },
      {
        productSku: 'BATCH-002',
        quantity: 180,
        platforms: ['elevenst', 'coupang', 'naver']
      }
    ];

    const response = await axios.post(`${API_BASE_URL}/inventory/sync`, {
      inventoryUpdates
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': CLIENT_ID
      }
    });

    console.log('✅ 재고 동기화 완료!');
    console.log(`동기화 작업 ID: ${response.data.data.syncJobId}`);
    console.log(`총 업데이트 수: ${response.data.data.summary.totalUpdates}`);
    console.log(`성공: ${response.data.data.summary.successCount}건`);
    console.log(`실패: ${response.data.data.summary.failureCount}건`);

    return response.data.data;

  } catch (error) {
    console.error('❌ 재고 동기화 실패:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 작업 상태 모니터링 예시
 */
async function monitorJobStatus(jobId) {
  try {
    console.log(`📊 작업 상태 조회: ${jobId}\n`);

    const response = await axios.get(`${API_BASE_URL}/jobs/${jobId}`, {
      headers: {
        'X-Client-ID': CLIENT_ID
      }
    });

    const job = response.data.data;
    console.log(`작업 상태: ${job.status}`);
    console.log(`시작 시간: ${new Date(job.startedAt).toLocaleString('ko-KR')}`);

    if (job.completedAt) {
      console.log(`완료 시간: ${new Date(job.completedAt).toLocaleString('ko-KR')}`);

      const duration = new Date(job.completedAt) - new Date(job.startedAt);
      console.log(`소요 시간: ${Math.round(duration / 1000)}초`);
    }

    if (job.results) {
      console.log('\n📋 작업 결과:');
      if (job.results.successful) {
        console.log(`  성공: ${job.results.successful.length}건`);
      }
      if (job.results.failed) {
        console.log(`  실패: ${job.results.failed.length}건`);
      }
    }

    return job;

  } catch (error) {
    console.error('❌ 작업 상태 조회 실패:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 시스템 상태 확인 예시
 */
async function checkSystemHealth() {
  try {
    console.log('🏥 시스템 상태 확인...\n');

    const response = await axios.get(`${API_BASE_URL}/health`, {
      headers: {
        'X-Client-ID': CLIENT_ID
      }
    });

    const health = response.data.data;
    console.log(`시스템 상태: ${health.status}`);
    console.log(`활성 작업 수: ${health.activeJobs}`);
    console.log(`지원 플랫폼: ${health.platformsAvailable.join(', ')}`);

    console.log('\n🔧 서비스 상태:');
    Object.entries(health.services).forEach(([service, status]) => {
      console.log(`  - ${service}: ${status}`);
    });

    return health;

  } catch (error) {
    console.error('❌ 시스템 상태 확인 실패:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 메인 실행 함수
 */
async function runExamples() {
  console.log('🎯 오픈마켓 통합 API 예시 실행\n');
  console.log('=' .repeat(50));

  try {
    // 1. 시스템 상태 확인
    await checkSystemHealth();
    console.log('\n' + '='.repeat(50));

    // 2. 카테고리 추천
    await getCategoryRecommendations();
    console.log('\n' + '='.repeat(50));

    // 3. 단일 상품 등록
    const singleResult = await registerSingleProduct();
    console.log('\n' + '='.repeat(50));

    // 4. 작업 상태 모니터링
    if (singleResult.jobId) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
      await monitorJobStatus(singleResult.jobId);
      console.log('\n' + '='.repeat(50));
    }

    // 5. 배치 상품 등록
    await registerMultipleProducts();
    console.log('\n' + '='.repeat(50));

    // 6. 주문 동기화
    await synchronizeOrders();
    console.log('\n' + '='.repeat(50));

    // 7. 재고 동기화
    await synchronizeInventory();
    console.log('\n' + '='.repeat(50));

    console.log('🎉 모든 예시가 성공적으로 실행되었습니다!');

  } catch (error) {
    console.error('\n💥 예시 실행 중 오류 발생:', error.message);
    process.exit(1);
  }
}

// 직접 실행시에만 예시 실행
if (require.main === module) {
  runExamples();
}

module.exports = {
  registerSingleProduct,
  registerMultipleProducts,
  getCategoryRecommendations,
  synchronizeOrders,
  synchronizeInventory,
  monitorJobStatus,
  checkSystemHealth
};