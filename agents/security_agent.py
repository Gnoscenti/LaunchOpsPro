"""
Security Agent - Bitwarden Password Manager Setup
Automates deployment and configuration of Bitwarden/Vaultwarden for team password management.
"""

from typing import Dict, List, Optional
import subprocess
import json
import os
from .base import BaseAgent


class SecurityAgent(BaseAgent):
    """
    Automates Bitwarden/Vaultwarden setup for secure password management.
    
    Capabilities:
    - Deploy Vaultwarden (open-source Bitwarden server)
    - Create master vault
    - Generate secure passwords
    - Setup 2FA policies
    - Configure team access
    """
    
    def __init__(self, llm_client, config: Dict):
        super().__init__(
            name="Security Agent",
            role="Password Manager & 2FA Setup",
            llm_client=llm_client,
            config=config
        )
        self.bitwarden_config = config.get('bitwarden', {})
        
    def analyze(self, context: Dict) -> Dict:
        """Analyze security requirements for the business."""
        business_name = context.get('business_name', 'Unknown')
        team_size = context.get('team_size', 1)
        domain = context.get('domain', '')
        
        analysis = {
            'business_name': business_name,
            'team_size': team_size,
            'vault_url': f"https://vault.{domain}" if domain else "http://localhost:8080",
            'required_passwords': self._identify_required_passwords(context),
            '2fa_required': team_size > 1,
            'recommendations': []
        }
        
        # Add recommendations
        if team_size > 5:
            analysis['recommendations'].append("Consider enterprise Bitwarden for advanced features")
        if not domain:
            analysis['recommendations'].append("Setup custom domain for production vault access")
            
        return analysis
    
    def execute(self, task: Dict) -> Dict:
        """Execute security setup tasks."""
        task_type = task.get('type')
        
        if task_type == 'deploy_bitwarden':
            return self._deploy_bitwarden(task)
        elif task_type == 'create_vault':
            return self._create_vault(task)
        elif task_type == 'generate_passwords':
            return self._generate_passwords(task)
        elif task_type == 'setup_2fa':
            return self._setup_2fa(task)
        elif task_type == 'configure_team':
            return self._configure_team(task)
        else:
            return {'success': False, 'error': f'Unknown task type: {task_type}'}
    
    def _identify_required_passwords(self, context: Dict) -> List[str]:
        """Identify all services that need passwords."""
        services = [
            'zoho_mail',
            'wordpress_admin',
            'wordpress_db',
            'nextcloud_admin',
            'suitecrm_admin',
            'openproject_admin',
            'mattermost_admin',
            'stripe_api',
            'database_root',
            'vps_root'
        ]
        
        # Add conditional services
        if context.get('use_chatwoot'):
            services.append('chatwoot_admin')
        if context.get('use_mautic'):
            services.append('mautic_admin')
            
        return services
    
    def _deploy_bitwarden(self, task: Dict) -> Dict:
        """Deploy Vaultwarden using Docker."""
        domain = task.get('domain', 'localhost')
        port = task.get('port', 8080)
        data_dir = task.get('data_dir', '/opt/vaultwarden/data')
        
        # Create data directory
        os.makedirs(data_dir, exist_ok=True)
        
        # Docker Compose configuration
        docker_compose = f"""
version: '3.8'

services:
  vaultwarden:
    image: vaultwarden/server:latest
    container_name: vaultwarden
    restart: unless-stopped
    environment:
      - DOMAIN=https://vault.{domain}
      - SIGNUPS_ALLOWED=true
      - INVITATIONS_ALLOWED=true
      - SHOW_PASSWORD_HINT=false
      - WEBSOCKET_ENABLED=true
    volumes:
      - {data_dir}:/data
    ports:
      - "{port}:80"
    networks:
      - bitwarden_network

networks:
  bitwarden_network:
    driver: bridge
"""
        
        # Write docker-compose.yml
        compose_path = os.path.join(data_dir, 'docker-compose.yml')
        with open(compose_path, 'w') as f:
            f.write(docker_compose)
        
        # Deploy with Docker Compose
        try:
            subprocess.run(
                ['docker-compose', '-f', compose_path, 'up', '-d'],
                check=True,
                capture_output=True,
                text=True
            )
            
            return {
                'success': True,
                'vault_url': f"http://localhost:{port}" if domain == 'localhost' else f"https://vault.{domain}",
                'data_dir': data_dir,
                'message': 'Vaultwarden deployed successfully'
            }
        except subprocess.CalledProcessError as e:
            return {
                'success': False,
                'error': f'Docker Compose failed: {e.stderr}'
            }
    
    def _create_vault(self, task: Dict) -> Dict:
        """Create master vault and organizational structure."""
        vault_url = task.get('vault_url')
        business_name = task.get('business_name')
        admin_email = task.get('admin_email')
        
        # In production, this would use Bitwarden CLI
        # For now, return instructions
        return {
            'success': True,
            'vault_url': vault_url,
            'instructions': [
                f"1. Navigate to {vault_url}",
                f"2. Create account with email: {admin_email}",
                "3. Enable 2FA on master account",
                f"4. Create organization: {business_name}",
                "5. Invite team members",
                "6. Setup collections for different service categories"
            ],
            'collections': [
                'Email & Communication',
                'Website & CMS',
                'Files & Documents',
                'CRM & Sales',
                'Project Management',
                'Financial & Payments',
                'Customer Support',
                'Marketing & Analytics',
                'Infrastructure & Ops'
            ]
        }
    
    def _generate_passwords(self, task: Dict) -> Dict:
        """Generate secure passwords for all services."""
        services = task.get('services', [])
        password_length = task.get('password_length', 32)
        
        # Generate secure passwords
        import secrets
        import string
        
        passwords = {}
        alphabet = string.ascii_letters + string.digits + string.punctuation
        
        for service in services:
            password = ''.join(secrets.choice(alphabet) for _ in range(password_length))
            passwords[service] = password
        
        return {
            'success': True,
            'passwords': passwords,
            'message': f'Generated {len(passwords)} secure passwords',
            'note': 'Store these in Bitwarden immediately and delete from this output'
        }
    
    def _setup_2fa(self, task: Dict) -> Dict:
        """Setup 2FA policies for the organization."""
        vault_url = task.get('vault_url')
        policy = task.get('policy', 'required')
        
        return {
            'success': True,
            'policy': policy,
            'instructions': [
                f"1. Login to {vault_url} as admin",
                "2. Go to Organization Settings",
                "3. Navigate to Policies",
                "4. Enable 'Two-step Login' policy",
                f"5. Set policy to: {policy}",
                "6. Save changes",
                "7. Notify team members to enable 2FA"
            ],
            'recommended_2fa_methods': [
                'Authenticator app (Google Authenticator, Authy)',
                'YubiKey (hardware token)',
                'Email (backup method only)'
            ]
        }
    
    def _configure_team(self, task: Dict) -> Dict:
        """Configure team access and permissions."""
        team_members = task.get('team_members', [])
        vault_url = task.get('vault_url')
        
        return {
            'success': True,
            'team_size': len(team_members),
            'members': team_members,
            'instructions': [
                f"1. Login to {vault_url} as admin",
                "2. Go to Organization → Manage → People",
                "3. Click 'Invite User'",
                "4. Add each team member email",
                "5. Assign appropriate collections",
                "6. Set user type (User/Manager/Admin)",
                "7. Send invitations"
            ],
            'permission_recommendations': {
                'founders': 'Admin - Full access to all collections',
                'developers': 'User - Access to Infrastructure & Website collections',
                'sales': 'User - Access to CRM & Email collections',
                'support': 'User - Access to Customer Support collection',
                'contractors': 'User - Limited access, specific collections only'
            }
        }
    
    def validate(self, result: Dict) -> Dict:
        """Validate security setup."""
        checks = {
            'vault_deployed': False,
            'vault_accessible': False,
            'master_account_created': False,
            '2fa_enabled': False,
            'organization_created': False,
            'passwords_generated': False,
            'team_configured': False
        }
        
        # In production, these would be actual checks
        # For now, return validation checklist
        
        return {
            'valid': False,  # Requires manual verification
            'checks': checks,
            'manual_verification_required': True,
            'verification_steps': [
                "1. Confirm Vaultwarden is running (docker ps)",
                "2. Access vault URL in browser",
                "3. Login with master account",
                "4. Verify 2FA is enabled",
                "5. Check organization exists",
                "6. Verify all passwords are stored",
                "7. Confirm team members have access"
            ]
        }
