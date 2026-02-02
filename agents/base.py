"""
Base Agent Class for LaunchOps Founder Edition
Provides common functionality for all service setup agents.
"""

from typing import Dict, List, Optional, Any
from abc import ABC, abstractmethod
import logging
import json
from datetime import datetime


class BaseAgent(ABC):
    """
    Abstract base class for all LaunchOps agents.
    
    All agents must implement:
    - analyze(): Assess requirements and generate recommendations
    - execute(): Perform automated setup tasks
    - validate(): Verify setup was successful
    """
    
    def __init__(self, name: str, role: str, llm_client=None, config: Dict = None):
        """
        Initialize base agent.
        
        Args:
            name: Human-readable agent name
            role: Agent's primary responsibility
            llm_client: Optional LLM client for intelligent decision-making
            config: Configuration dictionary
        """
        self.name = name
        self.role = role
        self.llm_client = llm_client
        self.config = config or {}
        self.logger = self._setup_logger()
        self.execution_history: List[Dict] = []
        
    def _setup_logger(self) -> logging.Logger:
        """Setup agent-specific logger."""
        logger = logging.Logger(self.name)
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            f'[{self.name}] %(asctime)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        return logger
    
    @abstractmethod
    def analyze(self, context: Dict) -> Dict:
        """
        Analyze business requirements and generate recommendations.
        
        Args:
            context: Business context including name, domain, team size, etc.
            
        Returns:
            Dict containing analysis results and recommendations
        """
        pass
    
    @abstractmethod
    def execute(self, task: Dict) -> Dict:
        """
        Execute a specific setup task.
        
        Args:
            task: Task specification with type and parameters
            
        Returns:
            Dict containing execution results and any generated credentials
        """
        pass
    
    @abstractmethod
    def validate(self, result: Dict) -> Dict:
        """
        Validate that setup was successful.
        
        Args:
            result: Result from execute() to validate
            
        Returns:
            Dict containing validation status and any issues found
        """
        pass
    
    def run(self, context: Dict, tasks: List[Dict]) -> Dict:
        """
        Complete workflow: analyze → execute → validate.
        
        Args:
            context: Business context
            tasks: List of tasks to execute
            
        Returns:
            Dict containing complete workflow results
        """
        self.logger.info(f"Starting {self.name} workflow")
        
        # Step 1: Analyze
        analysis = self.analyze(context)
        self.logger.info(f"Analysis complete: {len(analysis.get('recommendations', []))} recommendations")
        
        # Step 2: Execute tasks
        results = []
        for task in tasks:
            self.logger.info(f"Executing task: {task.get('type')}")
            result = self.execute(task)
            results.append(result)
            
            # Record in history
            self.execution_history.append({
                'timestamp': datetime.now().isoformat(),
                'task': task,
                'result': result
            })
            
            if not result.get('success'):
                self.logger.error(f"Task failed: {result.get('error')}")
                # Continue with other tasks even if one fails
        
        # Step 3: Validate
        validation = self.validate({'results': results})
        self.logger.info(f"Validation complete: {validation.get('valid', False)}")
        
        return {
            'agent': self.name,
            'analysis': analysis,
            'results': results,
            'validation': validation,
            'success': validation.get('valid', False),
            'timestamp': datetime.now().isoformat()
        }
    
    def get_credentials(self, service: str) -> Optional[Dict]:
        """
        Retrieve stored credentials for a service.
        
        Args:
            service: Service name (e.g., 'wordpress', 'stripe')
            
        Returns:
            Dict containing credentials or None if not found
        """
        # This would integrate with the credential vault
        # For now, return placeholder
        return self.config.get('credentials', {}).get(service)
    
    def store_credentials(self, service: str, credentials: Dict) -> bool:
        """
        Store credentials securely in vault.
        
        Args:
            service: Service name
            credentials: Credentials to store
            
        Returns:
            True if successful, False otherwise
        """
        # This would integrate with Bitwarden vault
        # For now, store in config
        if 'credentials' not in self.config:
            self.config['credentials'] = {}
        self.config['credentials'][service] = credentials
        self.logger.info(f"Stored credentials for {service}")
        return True
    
    def generate_secure_password(self, length: int = 32) -> str:
        """Generate a cryptographically secure password."""
        import secrets
        import string
        alphabet = string.ascii_letters + string.digits + string.punctuation
        return ''.join(secrets.choice(alphabet) for _ in range(length))
    
    def run_command(self, command: str, cwd: str = None) -> Dict:
        """
        Execute shell command safely.
        
        Args:
            command: Command to execute
            cwd: Working directory
            
        Returns:
            Dict with stdout, stderr, and return code
        """
        import subprocess
        
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            return {
                'success': result.returncode == 0,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode
            }
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': 'Command timed out after 5 minutes'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def write_file(self, path: str, content: str) -> bool:
        """
        Write content to file safely.
        
        Args:
            path: File path
            content: Content to write
            
        Returns:
            True if successful, False otherwise
        """
        try:
            import os
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w') as f:
                f.write(content)
            self.logger.info(f"Wrote file: {path}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to write file {path}: {e}")
            return False
    
    def read_file(self, path: str) -> Optional[str]:
        """
        Read file content safely.
        
        Args:
            path: File path
            
        Returns:
            File content or None if failed
        """
        try:
            with open(path, 'r') as f:
                return f.read()
        except Exception as e:
            self.logger.error(f"Failed to read file {path}: {e}")
            return None
    
    def check_docker_available(self) -> bool:
        """Check if Docker is available."""
        result = self.run_command('docker --version')
        return result.get('success', False)
    
    def check_docker_compose_available(self) -> bool:
        """Check if Docker Compose is available."""
        result = self.run_command('docker-compose --version')
        return result.get('success', False)
    
    def deploy_docker_compose(self, compose_file: str, project_name: str) -> Dict:
        """
        Deploy services using Docker Compose.
        
        Args:
            compose_file: Path to docker-compose.yml
            project_name: Docker Compose project name
            
        Returns:
            Dict with deployment results
        """
        if not self.check_docker_compose_available():
            return {
                'success': False,
                'error': 'Docker Compose not available'
            }
        
        command = f'docker-compose -f {compose_file} -p {project_name} up -d'
        result = self.run_command(command)
        
        if result.get('success'):
            self.logger.info(f"Deployed {project_name} successfully")
        else:
            self.logger.error(f"Failed to deploy {project_name}: {result.get('stderr')}")
        
        return result
    
    def get_docker_service_status(self, project_name: str) -> Dict:
        """Get status of Docker Compose services."""
        command = f'docker-compose -p {project_name} ps --format json'
        result = self.run_command(command)
        
        if result.get('success'):
            try:
                services = json.loads(result.get('stdout', '[]'))
                return {
                    'success': True,
                    'services': services
                }
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'error': 'Failed to parse service status'
                }
        return result
    
    def wait_for_service(self, url: str, timeout: int = 60) -> bool:
        """
        Wait for service to become available.
        
        Args:
            url: Service URL to check
            timeout: Maximum wait time in seconds
            
        Returns:
            True if service is available, False if timeout
        """
        import time
        import requests
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                response = requests.get(url, timeout=5)
                if response.status_code < 500:
                    self.logger.info(f"Service available at {url}")
                    return True
            except requests.RequestException:
                pass
            time.sleep(5)
        
        self.logger.error(f"Service at {url} not available after {timeout}s")
        return False
    
    def get_execution_summary(self) -> Dict:
        """Get summary of all executions."""
        return {
            'agent': self.name,
            'total_executions': len(self.execution_history),
            'successful': sum(1 for h in self.execution_history if h['result'].get('success')),
            'failed': sum(1 for h in self.execution_history if not h['result'].get('success')),
            'history': self.execution_history
        }
