"""
Stripe Agent - Automated Payment Setup
Creates Stripe account and configures payment processing.
"""

from typing import Dict, List
from .base import BaseAgent


class StripeAgent(BaseAgent):
    """
    Automates Stripe account creation and configuration.
    
    Capabilities:
    - Create Stripe account
    - Configure payment methods
    - Setup webhooks
    - Create products and prices
    - Configure subscription billing
    - Setup payment links
    """
    
    def __init__(self, llm_client, config: Dict):
        super().__init__(
            name="Stripe Agent",
            role="Payment Processing Setup",
            llm_client=llm_client,
            config=config
        )
        
    def analyze(self, context: Dict) -> Dict:
        """Analyze payment requirements."""
        business_name = context.get('business_name')
        business_type = context.get('business_type', 'saas')
        pricing_model = context.get('pricing_model', 'subscription')
        
        recommendations = []
        
        if pricing_model == 'subscription':
            recommendations.append("Use Stripe Billing for recurring payments")
            recommendations.append("Setup subscription tiers with different features")
            recommendations.append("Enable automatic invoice generation")
        elif pricing_model == 'one-time':
            recommendations.append("Use Stripe Checkout for one-time payments")
            recommendations.append("Create payment links for easy sharing")
        
        recommendations.extend([
            "Enable 3D Secure for fraud protection",
            "Setup webhooks for payment notifications",
            "Configure tax calculation (if applicable)",
            "Enable customer portal for self-service"
        ])
        
        return {
            'business_name': business_name,
            'pricing_model': pricing_model,
            'recommended_payment_methods': [
                'card',  # Credit/debit cards
                'us_bank_account',  # ACH
                'link',  # Stripe Link
            ],
            'recommended_features': [
                'automatic_tax',
                'customer_portal',
                'invoice_generation',
                'payment_method_update'
            ],
            'recommendations': recommendations
        }
    
    def execute(self, task: Dict) -> Dict:
        """Execute Stripe setup tasks."""
        task_type = task.get('type')
        
        if task_type == 'create_account':
            return self._create_account(task)
        elif task_type == 'configure_webhooks':
            return self._configure_webhooks(task)
        elif task_type == 'create_products':
            return self._create_products(task)
        elif task_type == 'setup_billing':
            return self._setup_billing(task)
        elif task_type == 'create_payment_links':
            return self._create_payment_links(task)
        else:
            return {'success': False, 'error': f'Unknown task type: {task_type}'}
    
    def _create_account(self, task: Dict) -> Dict:
        """
        Create Stripe account.
        
        Note: Stripe account creation requires manual signup due to KYC requirements.
        This method provides instructions and stores credentials once created.
        """
        business_name = task.get('business_name')
        email = task.get('email')
        country = task.get('country', 'US')
        
        return {
            'success': True,
            'account_type': 'Standard',
            'instructions': [
                "1. Visit https://dashboard.stripe.com/register",
                f"2. Sign up with email: {email}",
                f"3. Business name: {business_name}",
                f"4. Country: {country}",
                "5. Complete identity verification (KYC)",
                "6. Activate your account",
                "7. Get API keys from Developers → API keys",
                "8. Store keys in Bitwarden vault"
            ],
            'kyc_requirements': [
                'Business EIN or SSN',
                'Business address',
                'Bank account details',
                'Identity verification (passport/license)'
            ],
            'timeline': '1-3 business days for verification',
            'test_mode': {
                'note': 'Use test mode for development',
                'test_card': '4242 4242 4242 4242',
                'test_keys': 'Available immediately without verification'
            }
        }
    
    def _configure_webhooks(self, task: Dict) -> Dict:
        """Configure Stripe webhooks."""
        webhook_url = task.get('webhook_url')
        events = task.get('events', [
            'checkout.session.completed',
            'customer.subscription.created',
            'customer.subscription.updated',
            'customer.subscription.deleted',
            'invoice.payment_succeeded',
            'invoice.payment_failed',
            'payment_intent.succeeded',
            'payment_intent.payment_failed'
        ])
        
        return {
            'success': True,
            'webhook_url': webhook_url,
            'events': events,
            'instructions': [
                "1. Login to Stripe Dashboard",
                "2. Go to Developers → Webhooks",
                "3. Click 'Add endpoint'",
                f"4. Enter URL: {webhook_url}",
                "5. Select events to listen for:",
                *[f"   - {event}" for event in events],
                "6. Click 'Add endpoint'",
                "7. Copy webhook signing secret",
                "8. Store secret in environment variables"
            ],
            'webhook_handler_example': '''
# Example webhook handler (Express.js)
app.post('/api/stripe/webhook', 
  express.raw({type: 'application/json'}),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    try {
      const event = stripe.webhooks.constructEvent(
        req.body, sig, webhookSecret
      );
      
      // Handle event
      switch (event.type) {
        case 'checkout.session.completed':
          // Handle successful checkout
          break;
        case 'invoice.payment_succeeded':
          // Handle successful payment
          break;
        // ... handle other events
      }
      
      res.json({received: true});
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);
            '''
        }
    
    def _create_products(self, task: Dict) -> Dict:
        """Create Stripe products and prices."""
        products = task.get('products', [])
        
        if not products:
            # Default SaaS tiers
            products = [
                {
                    'name': 'Free',
                    'price': 0,
                    'interval': 'month',
                    'features': ['Basic features', 'Community support']
                },
                {
                    'name': 'Professional',
                    'price': 4900,  # $49.00
                    'interval': 'month',
                    'features': ['All features', 'Priority support', 'Advanced analytics']
                },
                {
                    'name': 'Enterprise',
                    'price': 19900,  # $199.00
                    'interval': 'month',
                    'features': ['Unlimited everything', 'Dedicated support', 'Custom integrations']
                }
            ]
        
        return {
            'success': True,
            'products': products,
            'instructions': [
                "1. Login to Stripe Dashboard",
                "2. Go to Products → Add product",
                "3. For each tier, create:",
                *[f"   - {p['name']}: ${p['price']/100:.2f}/{p.get('interval', 'month')}" 
                  for p in products if p['price'] > 0],
                "4. Set recurring billing interval",
                "5. Add product description and features",
                "6. Copy Price ID for integration"
            ],
            'api_example': '''
# Create product via API
const product = await stripe.products.create({
  name: 'Professional',
  description: 'Professional tier with all features'
});

const price = await stripe.prices.create({
  product: product.id,
  unit_amount: 4900,  // $49.00
  currency: 'usd',
  recurring: {interval: 'month'}
});
            '''
        }
    
    def _setup_billing(self, task: Dict) -> Dict:
        """Setup subscription billing."""
        return {
            'success': True,
            'billing_features': [
                'Automatic recurring charges',
                'Prorated upgrades/downgrades',
                'Trial periods',
                'Usage-based billing',
                'Invoice generation',
                'Customer portal'
            ],
            'instructions': [
                "1. Enable Stripe Billing in Dashboard",
                "2. Configure billing settings:",
                "   - Invoice template",
                "   - Email notifications",
                "   - Payment retry logic",
                "   - Dunning management",
                "3. Enable Customer Portal:",
                "   - Go to Settings → Billing → Customer portal",
                "   - Enable portal",
                "   - Configure allowed actions",
                "4. Integrate into your app:",
                "   - Use Stripe Checkout for new subscriptions",
                "   - Use Customer Portal for management"
            ],
            'checkout_example': '''
# Create checkout session
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{
    price: 'price_xxx',  // Your Price ID
    quantity: 1
  }],
  success_url: 'https://yourdomain.com/success',
  cancel_url: 'https://yourdomain.com/cancel',
  customer_email: user.email
});

// Redirect to checkout
res.redirect(session.url);
            '''
        }
    
    def _create_payment_links(self, task: Dict) -> Dict:
        """Create Stripe payment links."""
        products = task.get('products', [])
        
        return {
            'success': True,
            'payment_links': [],
            'instructions': [
                "1. Go to Payment links in Dashboard",
                "2. Click 'New payment link'",
                "3. Select product/price",
                "4. Configure options:",
                "   - Collect customer info",
                "   - Allow promo codes",
                "   - Redirect after payment",
                "5. Copy shareable link",
                "6. Use in emails, social media, etc."
            ],
            'use_cases': [
                'Share on social media for quick purchases',
                'Include in email campaigns',
                'Add to website as CTA button',
                'Send directly to customers',
                'Use for one-time offers'
            ]
        }
    
    def validate(self, result: Dict) -> Dict:
        """Validate Stripe setup."""
        checks = {
            'account_created': False,
            'account_verified': False,
            'api_keys_obtained': False,
            'webhooks_configured': False,
            'products_created': False,
            'test_payment_successful': False
        }
        
        return {
            'valid': False,
            'checks': checks,
            'manual_verification_required': True,
            'verification_steps': [
                "1. Confirm Stripe account is active",
                "2. Verify identity verification is complete",
                "3. Check API keys are stored in vault",
                "4. Test webhook endpoint receives events",
                "5. Verify products are visible in Dashboard",
                "6. Complete test payment with test card",
                "7. Check webhook receives payment event"
            ],
            'test_payment': {
                'card': '4242 4242 4242 4242',
                'expiry': 'Any future date',
                'cvc': 'Any 3 digits',
                'zip': 'Any 5 digits'
            }
        }
