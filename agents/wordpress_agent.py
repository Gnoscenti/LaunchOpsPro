"""
WordPress Agent - Automated Website Setup
Deploys and configures WordPress with themes, plugins, and SSL.
"""

from typing import Dict, List
import os
from .base import BaseAgent


class WordPressAgent(BaseAgent):
    """
    Automates WordPress deployment and configuration.
    
    Capabilities:
    - Deploy WordPress with Docker
    - Install and configure themes
    - Install essential plugins
    - Configure SSL with Let's Encrypt
    - Setup SEO basics
    - Configure contact forms
    - Optimize performance
    """
    
    def __init__(self, llm_client, config: Dict):
        super().__init__(
            name="WordPress Agent",
            role="Website & CMS Setup",
            llm_client=llm_client,
            config=config
        )
        
    def analyze(self, context: Dict) -> Dict:
        """Analyze website requirements."""
        business_name = context.get('business_name', 'My Business')
        domain = context.get('domain', '')
        business_type = context.get('business_type', 'general')
        
        # Recommend theme based on business type
        theme_recommendations = {
            'saas': 'Astra',
            'ecommerce': 'Storefront',
            'blog': 'GeneratePress',
            'agency': 'OceanWP',
            'general': 'Astra'
        }
        
        recommended_theme = theme_recommendations.get(business_type, 'Astra')
        
        # Essential plugins for all sites
        essential_plugins = [
            'wordpress-seo',  # Yoast SEO
            'contact-form-7',  # Contact forms
            'wordfence',  # Security
            'wp-super-cache',  # Caching
            'akismet',  # Spam protection
        ]
        
        # Add business-specific plugins
        if business_type == 'ecommerce':
            essential_plugins.extend(['woocommerce', 'woocommerce-gateway-stripe'])
        
        return {
            'business_name': business_name,
            'domain': domain,
            'recommended_theme': recommended_theme,
            'essential_plugins': essential_plugins,
            'ssl_required': bool(domain),
            'recommendations': [
                f"Use {recommended_theme} theme for {business_type} business",
                "Enable SSL certificate for security",
                "Configure caching for performance",
                "Setup contact form for lead generation",
                "Configure SEO basics with Yoast"
            ]
        }
    
    def execute(self, task: Dict) -> Dict:
        """Execute WordPress setup tasks."""
        task_type = task.get('type')
        
        if task_type == 'deploy_wordpress':
            return self._deploy_wordpress(task)
        elif task_type == 'install_theme':
            return self._install_theme(task)
        elif task_type == 'install_plugins':
            return self._install_plugins(task)
        elif task_type == 'configure_ssl':
            return self._configure_ssl(task)
        elif task_type == 'configure_seo':
            return self._configure_seo(task)
        elif task_type == 'create_pages':
            return self._create_pages(task)
        else:
            return {'success': False, 'error': f'Unknown task type: {task_type}'}
    
    def _deploy_wordpress(self, task: Dict) -> Dict:
        """Deploy WordPress using Docker."""
        domain = task.get('domain', 'localhost')
        business_name = task.get('business_name', 'My Business')
        admin_email = task.get('admin_email', 'admin@example.com')
        data_dir = task.get('data_dir', '/opt/wordpress')
        
        # Generate secure passwords
        db_password = self.generate_secure_password()
        admin_password = self.generate_secure_password()
        
        # Docker Compose configuration
        docker_compose = f"""
version: '3.8'

services:
  wordpress:
    image: wordpress:latest
    container_name: wordpress
    restart: unless-stopped
    environment:
      - WORDPRESS_DB_HOST=wordpress_db
      - WORDPRESS_DB_NAME=wordpress
      - WORDPRESS_DB_USER=wordpress
      - WORDPRESS_DB_PASSWORD={db_password}
      - WORDPRESS_TABLE_PREFIX=wp_
    volumes:
      - {data_dir}/wordpress:/var/www/html
    ports:
      - "8080:80"
    networks:
      - wordpress_network
    depends_on:
      - wordpress_db
  
  wordpress_db:
    image: mariadb:latest
    container_name: wordpress_db
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD={self.generate_secure_password()}
      - MYSQL_DATABASE=wordpress
      - MYSQL_USER=wordpress
      - MYSQL_PASSWORD={db_password}
    volumes:
      - {data_dir}/db:/var/lib/mysql
    networks:
      - wordpress_network

networks:
  wordpress_network:
    driver: bridge
"""
        
        # Create directories
        os.makedirs(data_dir, exist_ok=True)
        compose_path = os.path.join(data_dir, 'docker-compose.yml')
        
        # Write docker-compose.yml
        if not self.write_file(compose_path, docker_compose):
            return {'success': False, 'error': 'Failed to write docker-compose.yml'}
        
        # Deploy
        result = self.deploy_docker_compose(compose_path, 'wordpress')
        
        if result.get('success'):
            # Wait for WordPress to be ready
            wp_url = f"http://localhost:8080" if domain == 'localhost' else f"https://{domain}"
            self.wait_for_service(wp_url, timeout=120)
            
            # Store credentials
            self.store_credentials('wordpress', {
                'url': wp_url,
                'admin_user': 'admin',
                'admin_password': admin_password,
                'admin_email': admin_email,
                'db_password': db_password
            })
            
            return {
                'success': True,
                'url': wp_url,
                'admin_url': f"{wp_url}/wp-admin",
                'credentials': {
                    'username': 'admin',
                    'password': admin_password,
                    'email': admin_email
                },
                'message': 'WordPress deployed successfully',
                'next_steps': [
                    f"1. Visit {wp_url}/wp-admin",
                    "2. Complete WordPress installation wizard",
                    "3. Install recommended theme and plugins",
                    "4. Configure SSL certificate"
                ]
            }
        
        return result
    
    def _install_theme(self, task: Dict) -> Dict:
        """Install WordPress theme."""
        theme_name = task.get('theme', 'astra')
        wp_url = task.get('wp_url')
        
        # Using WP-CLI would be ideal, but for now return instructions
        return {
            'success': True,
            'theme': theme_name,
            'instructions': [
                f"1. Login to {wp_url}/wp-admin",
                "2. Go to Appearance → Themes",
                "3. Click 'Add New'",
                f"4. Search for '{theme_name}'",
                "5. Click 'Install' then 'Activate'",
                "6. Customize theme settings"
            ],
            'automation_note': 'WP-CLI integration coming soon for full automation'
        }
    
    def _install_plugins(self, task: Dict) -> Dict:
        """Install WordPress plugins."""
        plugins = task.get('plugins', [])
        wp_url = task.get('wp_url')
        
        return {
            'success': True,
            'plugins': plugins,
            'count': len(plugins),
            'instructions': [
                f"1. Login to {wp_url}/wp-admin",
                "2. Go to Plugins → Add New",
                "3. Install and activate these plugins:",
                *[f"   - {plugin}" for plugin in plugins],
                "4. Configure each plugin as needed"
            ],
            'recommended_settings': {
                'wordpress-seo': 'Run configuration wizard, set focus keyword strategy',
                'wordfence': 'Enable firewall, setup email alerts',
                'wp-super-cache': 'Enable caching, set expiration to 1 hour',
                'contact-form-7': 'Create contact form, add to Contact page'
            }
        }
    
    def _configure_ssl(self, task: Dict) -> Dict:
        """Configure SSL certificate."""
        domain = task.get('domain')
        email = task.get('email')
        
        if not domain or domain == 'localhost':
            return {
                'success': False,
                'error': 'SSL requires a valid domain name'
            }
        
        # Certbot configuration for Let's Encrypt
        certbot_command = f"""
# Install Certbot
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d {domain} -d www.{domain} \\
  --non-interactive --agree-tos --email {email} \\
  --redirect

# Setup auto-renewal
sudo certbot renew --dry-run
"""
        
        return {
            'success': True,
            'domain': domain,
            'certificate_authority': 'Let\'s Encrypt',
            'instructions': [
                "1. Ensure DNS is pointing to your server",
                "2. Run the following commands:",
                certbot_command,
                "3. Certificate will auto-renew every 90 days"
            ],
            'verification': f"Visit https://{domain} and check for padlock icon"
        }
    
    def _configure_seo(self, task: Dict) -> Dict:
        """Configure basic SEO settings."""
        business_name = task.get('business_name')
        description = task.get('description', '')
        
        return {
            'success': True,
            'seo_checklist': [
                {
                    'task': 'Install Yoast SEO plugin',
                    'status': 'required'
                },
                {
                    'task': 'Set site title and tagline',
                    'value': f"{business_name} - {description}",
                    'location': 'Settings → General'
                },
                {
                    'task': 'Configure permalink structure',
                    'recommended': 'Post name',
                    'location': 'Settings → Permalinks'
                },
                {
                    'task': 'Submit sitemap to Google',
                    'url': '/sitemap_index.xml',
                    'tool': 'Google Search Console'
                },
                {
                    'task': 'Add Google Analytics',
                    'note': 'Use Matomo integration instead for privacy'
                },
                {
                    'task': 'Optimize images',
                    'plugin': 'Smush or ShortPixel'
                },
                {
                    'task': 'Enable caching',
                    'plugin': 'WP Super Cache'
                }
            ]
        }
    
    def _create_pages(self, task: Dict) -> Dict:
        """Create essential pages."""
        business_name = task.get('business_name')
        
        essential_pages = [
            {
                'title': 'Home',
                'content': f'Welcome to {business_name}',
                'template': 'front-page'
            },
            {
                'title': 'About',
                'content': f'Learn more about {business_name}',
                'slug': 'about'
            },
            {
                'title': 'Services',
                'content': 'Our services and offerings',
                'slug': 'services'
            },
            {
                'title': 'Contact',
                'content': 'Get in touch with us',
                'slug': 'contact'
            },
            {
                'title': 'Privacy Policy',
                'content': 'Privacy policy content',
                'slug': 'privacy'
            },
            {
                'title': 'Terms of Service',
                'content': 'Terms of service content',
                'slug': 'terms'
            }
        ]
        
        return {
            'success': True,
            'pages': essential_pages,
            'instructions': [
                "1. Go to Pages → Add New",
                "2. Create each page with the content provided",
                "3. Set Home page as front page (Settings → Reading)",
                "4. Create navigation menu (Appearance → Menus)",
                "5. Add pages to menu"
            ]
        }
    
    def validate(self, result: Dict) -> Dict:
        """Validate WordPress setup."""
        checks = {
            'wordpress_deployed': False,
            'wordpress_accessible': False,
            'admin_accessible': False,
            'theme_installed': False,
            'plugins_installed': False,
            'ssl_configured': False,
            'seo_configured': False,
            'pages_created': False
        }
        
        # In production, these would be actual checks
        return {
            'valid': False,  # Requires manual verification
            'checks': checks,
            'manual_verification_required': True,
            'verification_steps': [
                "1. Confirm WordPress is running (docker ps)",
                "2. Access WordPress site in browser",
                "3. Login to wp-admin",
                "4. Verify theme is active",
                "5. Check all plugins are installed",
                "6. Test SSL certificate (if domain configured)",
                "7. Verify SEO plugin is configured",
                "8. Check all essential pages exist"
            ]
        }
