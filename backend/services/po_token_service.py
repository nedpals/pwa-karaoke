"""
PO Token service for YouTube using Playwright browser automation.
"""
from typing import Optional, Dict, List
import logging
import time

logger = logging.getLogger(__name__)


class POTokenService:
    """Service to generate YouTube PO tokens using browser automation with rotation."""
    
    def __init__(self):
        self._token_pool: List[Dict[str, str]] = []
        self._current_token_index = 0
        self._max_pool_size = 10
        self._token_expiry_duration = 3600  # 1 hour
        
    async def get_po_token(self) -> Optional[Dict[str, str]]:
        """
        Get next available PO token from the rotation pool.
        Returns dict with 'poToken' and 'visitorData' keys.
        """
        # Clean expired tokens
        await self._clean_expired_tokens()
        
        # If no tokens available, return None
        if not self._token_pool:
            return None
            
        # Get next token in rotation
        token_data = self._token_pool[self._current_token_index]
        self._current_token_index = (self._current_token_index + 1) % len(self._token_pool)
        
        return {
            'poToken': token_data['poToken'],
            'visitorData': token_data['visitorData']
        }
                
    async def add_token_from_page(self, page) -> None:
        """
        Extract and store PO token from an existing YouTube page.
        This is called during search operations to harvest tokens efficiently.
        """
        try:
            # Extract PO token and visitor data from the current page
            token_data = await page.evaluate("""
                () => {
                    // Helper function to search for tokens in various locations
                    function findTokens() {
                        let result = { visitorData: null, poToken: null };
                        
                        // Primary location: ytInitialData
                        if (window.ytInitialData?.responseContext) {
                            const rc = window.ytInitialData.responseContext;
                            result.visitorData = rc.visitorData;
                            
                            if (rc.serviceIntegrityDimensions?.poToken) {
                                result.poToken = rc.serviceIntegrityDimensions.poToken;
                            }
                        }
                        
                        // Alternative location: check for any global YouTube config
                        if (window.ytcfg && !result.visitorData) {
                            const data = window.ytcfg.data_;
                            if (data && data.VISITOR_DATA) {
                                result.visitorData = data.VISITOR_DATA;
                            }
                        }
                        
                        // Check for PO token in window.yt if not found
                        if (window.yt && !result.poToken) {
                            if (window.yt.config_?.PO_TOKEN) {
                                result.poToken = window.yt.config_.PO_TOKEN;
                            }
                        }
                        
                        return result;
                    }
                    
                    const tokens = findTokens();
                    
                    // Only return if we have both tokens
                    if (tokens.visitorData && tokens.poToken) {
                        return tokens;
                    }
                    
                    return null;
                }
            """)
            
            if token_data and token_data.get('poToken') and token_data.get('visitorData'):
                # Check if token already exists in pool
                token_exists = any(
                    existing['poToken'] == token_data['poToken'] 
                    for existing in self._token_pool
                )
                
                if not token_exists and len(self._token_pool) < self._max_pool_size:
                    token_entry = {
                        'poToken': token_data['poToken'],
                        'visitorData': token_data['visitorData'],
                        'created_at': time.time()
                    }
                    self._token_pool.append(token_entry)
                    logger.info(f"Added new PO token to pool. Pool size: {len(self._token_pool)}")
                elif len(self._token_pool) >= self._max_pool_size:
                    # Replace oldest token if pool is full
                    oldest_index = min(range(len(self._token_pool)), 
                                     key=lambda i: self._token_pool[i]['created_at'])
                    self._token_pool[oldest_index] = {
                        'poToken': token_data['poToken'],
                        'visitorData': token_data['visitorData'],
                        'created_at': time.time()
                    }
                    logger.info("Replaced oldest PO token in full pool")
                    
        except Exception as e:
            logger.debug(f"Could not extract PO token from page: {e}")
    
    async def _clean_expired_tokens(self) -> None:
        """Remove expired tokens from the pool."""
        current_time = time.time()
        self._token_pool = [
            token for token in self._token_pool 
            if current_time - token['created_at'] < self._token_expiry_duration
        ]
        
        # Reset index if it's out of bounds
        if self._current_token_index >= len(self._token_pool):
            self._current_token_index = 0
            
    def get_pool_stats(self) -> Dict[str, int]:
        """Get statistics about the token pool."""
        return {
            'total_tokens': len(self._token_pool),
            'current_index': self._current_token_index,
            'max_pool_size': self._max_pool_size
        }
        
    async def clear_pool(self):
        """Clear all tokens from the pool."""
        self._token_pool.clear()
        self._current_token_index = 0


# Global instance
po_token_service = POTokenService()