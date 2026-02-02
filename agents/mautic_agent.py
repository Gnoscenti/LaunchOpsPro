"""
Mautic Agent - Marketing Automation Setup
Deploys and configures Mautic for email campaigns and marketing automation.
"""

from typing import Dict, List
import os
from .base import BaseAgent


class MauticAgent(BaseAgent):
    """
    Automates Mautic deployment and configuration.
    
    Capabilities:
    - Deploy Mautic with Docker
    - Configure email sending (SMTP)
    - Create email templates
    - Setup lead scoring
    - Configure campaigns
    - Setup tracking and analytics
    - Integrate with website
    """
    
    def __init__(self, llm_client, config: Dict):
        super().__init__(
            name="Mautic Agent",
            role="Marketing Automation Setup",
            llm_client=llm_client,
            config=config
        )
        
    def analyze(self, context: Dict) -> Dict:
        """Analyze marketing automation requirements."""
        business_name = context.get('business_name')
        business_type = context.get('business_type', 'saas')
        target_audience = context.get('target_audience', 'general')
        
        # Recommend campaign types based on business
        campaign_recommendations = {
            'saas': ['Free trial nurture', 'Onboarding sequence', 'Feature announcements', 'Upgrade prompts'],
            'ecommerce': ['Welcome series', 'Abandoned cart', 'Product recommendations', 'Win-back campaigns'],
            'agency': ['Lead nurture', 'Case study showcase', 'Service education', 'Referral requests'],
            'general': ['Welcome series', 'Newsletter', 'Product updates', 'Re-engagement']
        }
        
        recommended_campaigns = campaign_recommendations.get(business_type, campaign_recommendations['general'])
        
        return {
            'business_name': business_name,
            'business_type': business_type,
            'recommended_campaigns': recommended_campaigns,
            'lead_scoring_criteria': [
                'Email opens (+5 points)',
                'Link clicks (+10 points)',
                'Form submissions (+20 points)',
                'Page visits (+3 points)',
                'Download content (+15 points)'
            ],
            'segmentation_strategies': [
                'By engagement level (hot/warm/cold)',
                'By product interest',
                'By funnel stage (awareness/consideration/decision)',
                'By demographic data',
                'By behavior patterns'
            ],
            'recommendations': [
                "Start with welcome email sequence",
                "Setup lead scoring to identify hot leads",
                "Create segments for targeted messaging",
                "Integrate tracking code on website",
                "Setup automated workflows for common scenarios"
            ]
        }
    
    def execute(self, task: Dict) -> Dict:
        """Execute Mautic setup tasks."""
        task_type = task.get('type')
        
        if task_type == 'deploy_mautic':
            return self._deploy_mautic(task)
        elif task_type == 'configure_email':
            return self._configure_email(task)
        elif task_type == 'create_templates':
            return self._create_templates(task)
        elif task_type == 'setup_tracking':
            return self._setup_tracking(task)
        elif task_type == 'create_campaigns':
            return self._create_campaigns(task)
        elif task_type == 'setup_lead_scoring':
            return self._setup_lead_scoring(task)
        else:
            return {'success': False, 'error': f'Unknown task type: {task_type}'}
    
    def _deploy_mautic(self, task: Dict) -> Dict:
        """Deploy Mautic using Docker."""
        domain = task.get('domain', 'localhost')
        data_dir = task.get('data_dir', '/opt/mautic')
        admin_email = task.get('admin_email')
        
        # Generate secure passwords
        db_password = self.generate_secure_password()
        admin_password = self.generate_secure_password()
        
        # Docker Compose configuration
        docker_compose = f"""
version: '3.8'

services:
  mautic:
    image: mautic/mautic:latest
    container_name: mautic
    restart: unless-stopped
    environment:
      - MAUTIC_DB_HOST=mautic_db
      - MAUTIC_DB_NAME=mautic
      - MAUTIC_DB_USER=mautic
      - MAUTIC_DB_PASSWORD={db_password}
      - MAUTIC_TRUSTED_PROXIES=0.0.0.0/0
    volumes:
      - {data_dir}/mautic:/var/www/html
    ports:
      - "8081:80"
    networks:
      - mautic_network
    depends_on:
      - mautic_db
  
  mautic_db:
    image: mariadb:latest
    container_name: mautic_db
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD={self.generate_secure_password()}
      - MYSQL_DATABASE=mautic
      - MYSQL_USER=mautic
      - MYSQL_PASSWORD={db_password}
    volumes:
      - {data_dir}/db:/var/lib/mysql
    networks:
      - mautic_network

networks:
  mautic_network:
    driver: bridge
"""
        
        # Create directories
        os.makedirs(data_dir, exist_ok=True)
        compose_path = os.path.join(data_dir, 'docker-compose.yml')
        
        # Write docker-compose.yml
        if not self.write_file(compose_path, docker_compose):
            return {'success': False, 'error': 'Failed to write docker-compose.yml'}
        
        # Deploy
        result = self.deploy_docker_compose(compose_path, 'mautic')
        
        if result.get('success'):
            # Wait for Mautic to be ready
            mautic_url = f"http://localhost:8081" if domain == 'localhost' else f"https://marketing.{domain}"
            self.wait_for_service(mautic_url, timeout=180)
            
            # Store credentials
            self.store_credentials('mautic', {
                'url': mautic_url,
                'admin_email': admin_email,
                'admin_password': admin_password,
                'db_password': db_password
            })
            
            return {
                'success': True,
                'url': mautic_url,
                'credentials': {
                    'email': admin_email,
                    'password': admin_password
                },
                'message': 'Mautic deployed successfully',
                'next_steps': [
                    f"1. Visit {mautic_url}",
                    "2. Complete installation wizard",
                    "3. Configure email sending (SMTP)",
                    "4. Add tracking code to website",
                    "5. Create first campaign"
                ]
            }
        
        return result
    
    def _configure_email(self, task: Dict) -> Dict:
        """Configure email sending via SMTP."""
        smtp_host = task.get('smtp_host', 'smtp.zoho.com')
        smtp_port = task.get('smtp_port', 587)
        smtp_user = task.get('smtp_user')
        smtp_password = task.get('smtp_password')
        from_email = task.get('from_email')
        from_name = task.get('from_name')
        
        return {
            'success': True,
            'smtp_config': {
                'host': smtp_host,
                'port': smtp_port,
                'encryption': 'TLS',
                'auth': 'login',
                'user': smtp_user,
                'from_email': from_email,
                'from_name': from_name
            },
            'instructions': [
                "1. Login to Mautic",
                "2. Go to Settings (gear icon) → Configuration",
                "3. Click 'Email Settings'",
                "4. Select 'Other SMTP Server'",
                f"5. SMTP Host: {smtp_host}",
                f"6. SMTP Port: {smtp_port}",
                "7. Encryption: TLS",
                "8. Authentication: Login",
                f"9. Username: {smtp_user}",
                "10. Password: [from vault]",
                f"11. From Email: {from_email}",
                f"12. From Name: {from_name}",
                "13. Click 'Save & Close'",
                "14. Send test email to verify"
            ],
            'test_email': {
                'note': 'Send test email from Configuration → Email Settings',
                'check': 'Verify email arrives and is not marked as spam'
            }
        }
    
    def _create_templates(self, task: Dict) -> Dict:
        """Create email templates."""
        business_name = task.get('business_name')
        brand_color = task.get('brand_color', '#0066cc')
        
        templates = [
            {
                'name': 'Welcome Email',
                'subject': f'Welcome to {business_name}!',
                'purpose': 'First email to new subscribers',
                'content_structure': [
                    'Warm greeting',
                    'Thank you for signing up',
                    'What to expect',
                    'Call to action',
                    'Contact information'
                ]
            },
            {
                'name': 'Newsletter',
                'subject': f'{business_name} Updates',
                'purpose': 'Regular updates and content',
                'content_structure': [
                    'Header with logo',
                    'Main article/update',
                    '2-3 secondary items',
                    'Social media links',
                    'Unsubscribe link'
                ]
            },
            {
                'name': 'Product Announcement',
                'subject': 'New Feature: [Feature Name]',
                'purpose': 'Announce new features or products',
                'content_structure': [
                    'Exciting news headline',
                    'Feature description',
                    'Benefits',
                    'CTA to try it',
                    'Support resources'
                ]
            }
        ]
        
        return {
            'success': True,
            'templates': templates,
            'brand_guidelines': {
                'primary_color': brand_color,
                'font': 'Arial, sans-serif',
                'logo_placement': 'Top center or top left',
                'button_style': 'Rounded corners, solid color'
            },
            'instructions': [
                "1. Go to Channels → Emails",
                "2. Click 'New'",
                "3. Select 'Template' email type",
                "4. Use drag-and-drop builder",
                "5. Add sections: header, body, footer",
                "6. Customize with brand colors",
                "7. Add dynamic content tokens",
                "8. Preview and test",
                "9. Save template"
            ],
            'dynamic_tokens': [
                '{contactfield=firstname}',
                '{contactfield=email}',
                '{contactfield=company}',
                '{unsubscribe_url}',
                '{webview_url}'
            ]
        }
    
    def _setup_tracking(self, task: Dict) -> Dict:
        """Setup website tracking."""
        mautic_url = task.get('mautic_url')
        website_url = task.get('website_url')
        
        tracking_code = f"""
<!-- Mautic Tracking Code -->
<script>
    (function(w,d,t,u,n,a,m){{w['MauticTrackingObject']=n;
        w[n]=w[n]||function(){{(w[n].q=w[n].q||[]).push(arguments)}},a=d.createElement(t),
        m=d.getElementsByTagName(t)[0];a.async=1;a.src=u;m.parentNode.insertBefore(a,m)
    }})(window,document,'script','{mautic_url}/mtc.js','mt');
    
    mt('send', 'pageview');
</script>
<!-- End Mautic Tracking Code -->
"""
        
        return {
            'success': True,
            'tracking_code': tracking_code,
            'instructions': [
                "1. Copy the tracking code above",
                "2. Add to your website's <head> section",
                "3. For WordPress:",
                "   - Use 'Insert Headers and Footers' plugin",
                "   - Or add to theme's header.php",
                "4. Verify tracking:",
                f"   - Visit {website_url}",
                "   - Check Mautic → Contacts",
                "   - You should see anonymous visitor",
                "5. Enable form tracking:",
                "   - Add mautic-form class to forms",
                "   - Or use Mautic form builder"
            ],
            'tracked_activities': [
                'Page visits',
                'Form submissions',
                'Link clicks',
                'Email opens',
                'Email clicks',
                'Asset downloads'
            ],
            'privacy_note': 'Ensure tracking complies with GDPR/CCPA. Add cookie consent banner.'
        }
    
    def _create_campaigns(self, task: Dict) -> Dict:
        """Create marketing campaigns."""
        campaign_types = task.get('campaign_types', ['welcome_series'])
        
        campaigns = {
            'welcome_series': {
                'name': 'Welcome Series',
                'description': 'Nurture new subscribers',
                'emails': [
                    {'day': 0, 'subject': 'Welcome!', 'goal': 'Introduce brand'},
                    {'day': 2, 'subject': 'Getting Started', 'goal': 'Show key features'},
                    {'day': 5, 'subject': 'Success Stories', 'goal': 'Build trust'},
                    {'day': 7, 'subject': 'Special Offer', 'goal': 'Convert to customer'}
                ]
            },
            'lead_nurture': {
                'name': 'Lead Nurture',
                'description': 'Convert leads to customers',
                'emails': [
                    {'trigger': 'form_submit', 'subject': 'Thanks for your interest'},
                    {'delay': '3 days', 'subject': 'How we can help'},
                    {'delay': '7 days', 'subject': 'Case study'},
                    {'delay': '14 days', 'subject': 'Ready to get started?'}
                ]
            },
            're_engagement': {
                'name': 'Re-engagement',
                'description': 'Win back inactive users',
                'trigger': 'No activity for 30 days',
                'emails': [
                    {'subject': 'We miss you!'},
                    {'delay': '7 days', 'subject': "What's new"},
                    {'delay': '14 days', 'subject': 'Last chance - special offer'}
                ]
            }
        }
        
        selected_campaigns = [campaigns[ct] for ct in campaign_types if ct in campaigns]
        
        return {
            'success': True,
            'campaigns': selected_campaigns,
            'instructions': [
                "1. Go to Channels → Campaigns",
                "2. Click 'New'",
                "3. Name your campaign",
                "4. Build campaign flow:",
                "   - Add trigger (form submit, segment, etc.)",
                "   - Add actions (send email, wait, etc.)",
                "   - Add decisions (opened email?, clicked link?)",
                "   - Add conditions (if/else logic)",
                "5. Connect elements",
                "6. Publish campaign"
            ],
            'best_practices': [
                'Start simple, add complexity later',
                'Test campaigns with small segment first',
                'Monitor open rates and adjust',
                'A/B test subject lines',
                'Personalize content with tokens',
                'Set clear goals for each email',
                'Clean list regularly (remove bounces)'
            ]
        }
    
    def _setup_lead_scoring(self, task: Dict) -> Dict:
        """Setup lead scoring rules."""
        return {
            'success': True,
            'scoring_model': {
                'engagement': [
                    {'action': 'Email opened', 'points': 5},
                    {'action': 'Email link clicked', 'points': 10},
                    {'action': 'Website visit', 'points': 3},
                    {'action': 'Form submitted', 'points': 20},
                    {'action': 'Asset downloaded', 'points': 15}
                ],
                'demographics': [
                    {'criteria': 'Job title contains "Director"', 'points': 10},
                    {'criteria': 'Company size > 50', 'points': 15},
                    {'criteria': 'Industry matches target', 'points': 10}
                ],
                'behavior': [
                    {'action': 'Visited pricing page', 'points': 20},
                    {'action': 'Watched demo video', 'points': 25},
                    {'action': 'Started free trial', 'points': 50}
                ]
            },
            'score_ranges': {
                'cold': '0-20 points',
                'warm': '21-50 points',
                'hot': '51+ points'
            },
            'instructions': [
                "1. Go to Settings → Points",
                "2. Click 'New'",
                "3. Add point actions:",
                "   - Select trigger (email open, page visit, etc.)",
                "   - Assign point value",
                "4. Create point triggers:",
                "   - When score reaches threshold",
                "   - Take action (notify sales, add to segment)",
                "5. Monitor lead scores in Contacts"
            ],
            'automation_ideas': [
                'Notify sales when lead reaches 50 points',
                'Move hot leads to priority segment',
                'Trigger special campaign for high-scoring leads',
                'Reduce email frequency for cold leads'
            ]
        }
    
    def validate(self, result: Dict) -> Dict:
        """Validate Mautic setup."""
        checks = {
            'mautic_deployed': False,
            'mautic_accessible': False,
            'email_configured': False,
            'test_email_sent': False,
            'tracking_installed': False,
            'templates_created': False,
            'campaign_active': False,
            'lead_scoring_configured': False
        }
        
        return {
            'valid': False,
            'checks': checks,
            'manual_verification_required': True,
            'verification_steps': [
                "1. Confirm Mautic is running (docker ps)",
                "2. Access Mautic in browser",
                "3. Login with admin credentials",
                "4. Send test email successfully",
                "5. Verify tracking code on website",
                "6. Check templates are created",
                "7. Activate at least one campaign",
                "8. Verify lead scoring rules exist",
                "9. Test full workflow: visit site → form submit → receive email"
            ]
        }
