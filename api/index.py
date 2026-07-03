import sys
import os

# Add the backend directory to sys.path so its internal imports resolve correctly
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, backend_path)

# Extend the search path of the already-loaded 'api' package to include backend/api
import api
backend_api_path = os.path.join(backend_path, 'api')
if hasattr(api, '__path__'):
    # Convert _NamespacePath to list if needed, or append directly
    if isinstance(api.__path__, list):
        api.__path__.append(backend_api_path)
    else:
        api.__path__ = list(api.__path__) + [backend_api_path]

from main import app
