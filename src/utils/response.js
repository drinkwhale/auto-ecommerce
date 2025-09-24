/**
 * API 응답을 위한 표준 유틸리티
 * 모든 API 응답은 이 형식을 따라야 함
 */

const ResponseStatus = {
  SUCCESS: 'success',
  ERROR: 'error',
  FAIL: 'fail'
};

/**
 * 성공 응답을 생성합니다
 * @param {Object} data - 응답 데이터
 * @param {string} message - 성공 메시지
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 200)
 * @returns {Object} 표준화된 성공 응답
 */
const Success = (data = null, message = 'Success', statusCode = 200) => {
  return {
    status: ResponseStatus.SUCCESS,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

/**
 * 실패 응답을 생성합니다 (클라이언트 오류)
 * @param {string} message - 실패 메시지
 * @param {Object} errors - 상세 오류 정보
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 400)
 * @returns {Object} 표준화된 실패 응답
 */
const Fail = (message = 'Bad Request', errors = null, statusCode = 400) => {
  return {
    status: ResponseStatus.FAIL,
    statusCode,
    message,
    errors,
    timestamp: new Date().toISOString()
  };
};

/**
 * 에러 응답을 생성합니다 (서버 오류)
 * @param {string} message - 에러 메시지
 * @param {Object} error - 에러 상세 정보
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 500)
 * @returns {Object} 표준화된 에러 응답
 */
const Error = (message = 'Internal Server Error', error = null, statusCode = 500) => {
  return {
    status: ResponseStatus.ERROR,
    statusCode,
    message,
    error: process.env.NODE_ENV === 'production' ? null : error,
    timestamp: new Date().toISOString()
  };
};

/**
 * 페이지네이션을 포함한 성공 응답을 생성합니다
 * @param {Array} data - 응답 데이터
 * @param {Object} pagination - 페이지네이션 정보
 * @param {string} message - 성공 메시지
 * @param {number} statusCode - HTTP 상태 코드
 * @returns {Object} 페이지네이션이 포함된 성공 응답
 */
const SuccessWithPagination = (data = [], pagination = {}, message = 'Success', statusCode = 200) => {
  return {
    status: ResponseStatus.SUCCESS,
    statusCode,
    message,
    data,
    pagination: {
      currentPage: pagination.currentPage || 1,
      totalPages: pagination.totalPages || 1,
      totalItems: pagination.totalItems || 0,
      itemsPerPage: pagination.itemsPerPage || 10
    },
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  ResponseStatus,
  Success,
  Fail,
  Error,
  SuccessWithPagination
};