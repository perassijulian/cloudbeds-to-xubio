/**
 * Creates a standardized error object for API responses
 * @param {Object} options - Error options
 * @param {string} options.message - Error message
 * @param {number} options.status - HTTP status code
 * @param {string} [options.details] - Additional error details
 * @param {string} [options.resourceId] - ID of the related resource (transaction, reservation, etc.)
 * @returns {Error} Enhanced error object
 */
function createApiError({ message, status, details, resourceId }) {
  const error = new Error(message);
  error.statusCode = status;
  error.details = details || 'No additional details';
  if (resourceId) error.resourceId = resourceId;
  
  // Classify error types
  if (status === 401 || status === 403) {
    error.isAuthError = true;
  } else if (status >= 500) {
    error.isServerError = true;
  } else if (status >= 400) {
    error.isClientError = true;
  }
  
  return error;
}

/**
 * Handles API response errors consistently
 * @param {Response} response - Fetch API Response object
 * @param {Object} options - Options
 * @param {string} [options.resourceType] - Type of resource being accessed
 * @param {string} [options.resourceId] - ID of the resource being accessed
 * @returns {Promise<never>} Rejects with a standardized error
 */
async function handleApiError(response, { resourceType, resourceId } = {}) {
  let errorDetails;
  
  try {
    const errorData = await response.json().catch(() => ({}));
    errorDetails = errorData.message || errorData.error || 'No additional details';
  } catch {
    errorDetails = await response.text().catch(() => 'Failed to parse error response');
  }
  
  const statusText = response.statusText || 'Unknown Error';
  const resourceInfo = resourceType ? ` for ${resourceType}${resourceId ? ` ${resourceId}` : ''}` : '';
  
  const error = createApiError({
    message: `API request failed${resourceInfo}: ${response.status} ${statusText}`,
    status: response.status,
    details: errorDetails,
    resourceId
  });
  
  throw error;
}

export { createApiError, handleApiError };
