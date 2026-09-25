/**
 * Build pagination metadata object to include in API responses.
 * @param {number|string} page  - current page (1-indexed)
 * @param {number|string} limit - items per page
 * @param {number}        total - total matching documents
 */
const getPaginationData = (page, limit, total) => {
  const currentPage  = parseInt(page)  || 1;
  const itemsPerPage = parseInt(limit) || 10;
  const totalPages   = Math.ceil(total / itemsPerPage);

  return {
    currentPage,
    itemsPerPage,
    totalItems: total,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
};

/**
 * Compute the MongoDB skip value for a given page and limit.
 * @param {number|string} page
 * @param {number|string} limit
 * @returns {number}
 */
const getSkip = (page, limit) => {
  const currentPage  = parseInt(page)  || 1;
  const itemsPerPage = parseInt(limit) || 10;
  return (currentPage - 1) * itemsPerPage;
};

module.exports = { getPaginationData, getSkip };
