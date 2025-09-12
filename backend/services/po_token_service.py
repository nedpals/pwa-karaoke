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
        Extract and store PO token by intercepting network requests to v1/player API.
        This captures tokens from actual video player requests.
        """
        try:
            captured_token = None
            
            # Set up request interception for v1/player API calls
            async def handle_request(request):
                nonlocal captured_token
                if 'v1/player' in request.url and request.method == 'POST':
                    try:
                        print(f"Intercepted v1/player request: {request.url}")
                        post_data = request.post_data
                        if post_data:
                            import json
                            payload = json.loads(post_data)
                            
                            # Extract PO token from serviceIntegrityDimensions.poToken
                            po_token = payload.get('serviceIntegrityDimensions', {}).get('poToken')
                            # Extract visitorData from context.client.visitorData
                            visitor_data = payload.get('context', {}).get('client', {}).get('visitorData')
                            
                            if po_token and visitor_data:
                                captured_token = {
                                    'poToken': po_token,
                                    'visitorData': visitor_data
                                }
                                logger.info("Captured PO token from v1/player request")
                    except Exception as e:
                        logger.debug(f"Error parsing player request: {e}")
            
            # Enable request interception
            await page.route("**/*", lambda route: route.continue_())
            page.on("request", handle_request)
            
            # Try to trigger a video play to generate v1/player request
            await self._trigger_video_play(page)
            
            # If we captured a token, add it to the pool
            if captured_token:
                await self._add_token_to_pool(captured_token)
                
        except Exception as e:
            logger.debug(f"Could not extract PO token from network requests: {e}")
            
    async def _trigger_video_play(self, page) -> None:
        """Try to trigger video playback to generate v1/player requests."""
        try:
            # Look for a play button and click it
            play_button_selectors = [
                '.ytp-large-play-button',
                '.ytp-cued-thumbnail-overlay-image'
            ]
            
            for selector in play_button_selectors:
                try:
                    play_button = await page.query_selector(selector)
                    print(f"Found play button with selector: {selector}")
                    if play_button:
                        await play_button.click()
                        break
                except Exception as e:
                    print(f"Play button not found with selector: {selector}, error: {e}")
                    continue
        except Exception as e:
            logger.debug(f"Could not trigger video play: {e}")

    async def _add_token_to_pool(self, token_data: Dict[str, str]) -> None:
        """Add a token to the rotation pool."""
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