#!/usr/bin/env python3
"""
LaunchOps Founder Edition - Main CLI
Complete business automation system with zero guardrails.
"""

import sys
import argparse
from typing import Dict, List
import os
import json
from datetime import datetime

# Import agents
from agents.security_agent import SecurityAgent
from agents.wordpress_agent import WordPressAgent
from agents.stripe_agent import StripeAgent
from agents.mautic_agent import MauticAgent
from agents.paralegal_bot import ParalegalBot


class LaunchOps:
    """Main LaunchOps orchestrator."""
    
    def __init__(self):
        self.version = "1.0.0-founder-edition"
        self.config = self._load_config()
        self.agents = {}
        
    def _load_config(self) -> Dict:
        """Load configuration from file."""
        config_path = os.path.expanduser('~/.launchops/config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        return {}
    
    def _save_config(self):
        """Save configuration to file."""
        config_dir = os.path.expanduser('~/.launchops')
        os.makedirs(config_dir, exist_ok=True)
        config_path = os.path.join(config_dir, 'config.json')
        with open(config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def initialize_agents(self, llm_client=None):
        """Initialize all agents."""
        self.agents = {
            'security': SecurityAgent(llm_client, self.config),
            'wordpress': WordPressAgent(llm_client, self.config),
            'stripe': StripeAgent(llm_client, self.config),
            'mautic': MauticAgent(llm_client, self.config),
            'paralegal': ParalegalBot(llm_client, self.config)
        }
    
    def launch_business(self, business_config: Dict):
        """
        Launch a complete business with all services.
        
        This is the main automation workflow that sets up:
        - Security (password manager)
        - Website (WordPress)
        - Payments (Stripe)
        - Marketing (Mautic)
        - Legal compliance (Paralegal Bot)
        """
        print("🚀 LaunchOps Founder Edition - Launching Your Business")
        print("=" * 60)
        print()
        
        business_name = business_config.get('business_name')
        print(f"Business: {business_name}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Initialize agents
        self.initialize_agents()
        
        results = {}
        
        # Phase 1: Security Setup
        print("📍 Phase 1: Security Setup")
        print("-" * 60)
        security_result = self._setup_security(business_config)
        results['security'] = security_result
        self._print_phase_result(security_result)
        print()
        
        # Phase 2: Legal Formation
        print("📍 Phase 2: Legal Formation & Compliance")
        print("-" * 60)
        legal_result = self._setup_legal(business_config)
        results['legal'] = legal_result
        self._print_phase_result(legal_result)
        print()
        
        # Phase 3: Website Setup
        print("📍 Phase 3: Website Setup")
        print("-" * 60)
        website_result = self._setup_website(business_config)
        results['website'] = website_result
        self._print_phase_result(website_result)
        print()
        
        # Phase 4: Payment Processing
        print("📍 Phase 4: Payment Processing")
        print("-" * 60)
        payment_result = self._setup_payments(business_config)
        results['payments'] = payment_result
        self._print_phase_result(payment_result)
        print()
        
        # Phase 5: Marketing Automation
        print("📍 Phase 5: Marketing Automation")
        print("-" * 60)
        marketing_result = self._setup_marketing(business_config)
        results['marketing'] = marketing_result
        self._print_phase_result(marketing_result)
        print()
        
        # Summary
        print("=" * 60)
        print("✅ Business Launch Complete!")
        print("=" * 60)
        self._print_summary(results)
        
        # Save results
        self._save_launch_results(business_name, results)
        
        return results
    
    def _setup_security(self, config: Dict) -> Dict:
        """Setup password manager and security."""
        agent = self.agents['security']
        
        # Analyze requirements
        analysis = agent.analyze(config)
        
        # Deploy Bitwarden
        deploy_result = agent.execute({
            'type': 'deploy_bitwarden',
            'data_dir': config.get('data_dir', '/opt/launchops'),
            'admin_email': config.get('email')
        })
        
        return {
            'success': deploy_result.get('success', False),
            'analysis': analysis,
            'deployment': deploy_result
        }
    
    def _setup_legal(self, config: Dict) -> Dict:
        """Setup legal formation and compliance."""
        agent = self.agents['paralegal']
        
        # Generate checklist
        checklist_result = agent.execute({
            'type': 'generate_checklist',
            'business_name': config.get('business_name'),
            'state': config.get('state', 'Delaware'),
            'entity_type': config.get('entity_type', 'LLC')
        })
        
        # Generate documents
        docs_result = agent.execute({
            'type': 'generate_documents',
            'business_name': config.get('business_name'),
            'state': config.get('state', 'Delaware'),
            'entity_type': config.get('entity_type', 'LLC')
        })
        
        # Setup compliance calendar
        calendar_result = agent.execute({
            'type': 'compliance_calendar',
            'formation_date': datetime.now().isoformat(),
            'state': config.get('state', 'Delaware'),
            'entity_type': config.get('entity_type', 'LLC')
        })
        
        return {
            'success': True,
            'checklist': checklist_result,
            'documents': docs_result,
            'calendar': calendar_result
        }
    
    def _setup_website(self, config: Dict) -> Dict:
        """Setup WordPress website."""
        agent = self.agents['wordpress']
        
        # Deploy WordPress
        deploy_result = agent.execute({
            'type': 'deploy_wordpress',
            'domain': config.get('domain', 'localhost'),
            'business_name': config.get('business_name'),
            'admin_email': config.get('email'),
            'data_dir': config.get('data_dir', '/opt/launchops')
        })
        
        return {
            'success': deploy_result.get('success', False),
            'deployment': deploy_result
        }
    
    def _setup_payments(self, config: Dict) -> Dict:
        """Setup Stripe payment processing."""
        agent = self.agents['stripe']
        
        # Analyze payment requirements
        analysis = agent.analyze(config)
        
        # Guide through account creation
        account_result = agent.execute({
            'type': 'create_account',
            'business_name': config.get('business_name'),
            'email': config.get('email'),
            'country': config.get('country', 'US')
        })
        
        return {
            'success': True,
            'analysis': analysis,
            'account_setup': account_result
        }
    
    def _setup_marketing(self, config: Dict) -> Dict:
        """Setup Mautic marketing automation."""
        agent = self.agents['mautic']
        
        # Deploy Mautic
        deploy_result = agent.execute({
            'type': 'deploy_mautic',
            'domain': config.get('domain', 'localhost'),
            'admin_email': config.get('email'),
            'data_dir': config.get('data_dir', '/opt/launchops')
        })
        
        return {
            'success': deploy_result.get('success', False),
            'deployment': deploy_result
        }
    
    def _print_phase_result(self, result: Dict):
        """Print phase result."""
        if result.get('success'):
            print("✅ Success")
        else:
            print("⚠️  Needs manual steps")
        
        # Print key information
        if 'deployment' in result:
            deployment = result['deployment']
            if 'url' in deployment:
                print(f"   URL: {deployment['url']}")
            if 'credentials' in deployment:
                print("   Credentials stored in vault")
    
    def _print_summary(self, results: Dict):
        """Print launch summary."""
        print()
        print("📊 Launch Summary:")
        print()
        
        for phase, result in results.items():
            status = "✅" if result.get('success') else "⚠️"
            print(f"{status} {phase.title()}")
        
        print()
        print("🔗 Service URLs:")
        print()
        
        # Extract URLs from results
        if 'security' in results and 'deployment' in results['security']:
            url = results['security']['deployment'].get('url')
            if url:
                print(f"   Password Manager: {url}")
        
        if 'website' in results and 'deployment' in results['website']:
            url = results['website']['deployment'].get('url')
            if url:
                print(f"   Website: {url}")
        
        if 'marketing' in results and 'deployment' in results['marketing']:
            url = results['marketing']['deployment'].get('url')
            if url:
                print(f"   Marketing: {url}")
        
        print()
        print("📝 Next Steps:")
        print("   1. Complete manual steps listed above")
        print("   2. Store all credentials in password manager")
        print("   3. Review compliance calendar")
        print("   4. Test all services")
        print("   5. Start building your product!")
        print()
    
    def _save_launch_results(self, business_name: str, results: Dict):
        """Save launch results to file."""
        results_dir = os.path.expanduser('~/.launchops/launches')
        os.makedirs(results_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{business_name.lower().replace(' ', '_')}_{timestamp}.json"
        filepath = os.path.join(results_dir, filename)
        
        with open(filepath, 'w') as f:
            json.dump({
                'business_name': business_name,
                'timestamp': timestamp,
                'results': results
            }, f, indent=2)
        
        print(f"📄 Results saved to: {filepath}")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description='LaunchOps Founder Edition - Complete Business Automation',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Launch a new business
  launchops launch --name "My Startup" --email "founder@example.com"
  
  # Deploy all services
  launchops deploy
  
  # Check service status
  launchops status
  
  # Get help for a specific command
  launchops launch --help
        """
    )
    
    parser.add_argument('--version', action='version', version='%(prog)s 1.0.0-founder-edition')
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Launch command
    launch_parser = subparsers.add_parser('launch', help='Launch a new business')
    launch_parser.add_argument('--name', required=True, help='Business name')
    launch_parser.add_argument('--email', required=True, help='Founder email')
    launch_parser.add_argument('--domain', help='Domain name (optional)')
    launch_parser.add_argument('--state', default='Delaware', help='State of incorporation')
    launch_parser.add_argument('--entity', default='LLC', choices=['LLC', 'C-Corp', 'S-Corp'], help='Entity type')
    launch_parser.add_argument('--type', default='saas', help='Business type (saas, ecommerce, agency, etc.)')
    
    # Deploy command
    deploy_parser = subparsers.add_parser('deploy', help='Deploy all services')
    
    # Status command
    status_parser = subparsers.add_parser('status', help='Check service status')
    
    # Stop command
    stop_parser = subparsers.add_parser('stop', help='Stop all services')
    
    # Restart command
    restart_parser = subparsers.add_parser('restart', help='Restart all services')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    launchops = LaunchOps()
    
    if args.command == 'launch':
        business_config = {
            'business_name': args.name,
            'email': args.email,
            'domain': args.domain,
            'state': args.state,
            'entity_type': args.entity,
            'business_type': args.type,
            'data_dir': '/opt/launchops'
        }
        
        launchops.launch_business(business_config)
    
    elif args.command == 'deploy':
        print("Deploying all services...")
        os.system('docker-compose up -d')
        print("✅ All services deployed!")
        print()
        print("Service URLs:")
        print("  Password Manager: http://localhost:8000")
        print("  WordPress: http://localhost:8080")
        print("  Mautic: http://localhost:8081")
        print("  Nextcloud: http://localhost:8082")
        print("  Chatwoot: http://localhost:8083")
        print("  Matomo: http://localhost:8084")
    
    elif args.command == 'status':
        os.system('docker-compose ps')
    
    elif args.command == 'stop':
        print("Stopping all services...")
        os.system('docker-compose down')
        print("✅ All services stopped!")
    
    elif args.command == 'restart':
        print("Restarting all services...")
        os.system('docker-compose restart')
        print("✅ All services restarted!")


if __name__ == '__main__':
    main()
