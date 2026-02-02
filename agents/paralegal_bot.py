"""
Paralegal Bot - Business Formation & Compliance Automation
Automates paperwork, filings, and compliance tracking for business formation.
"""

from typing import Dict, List
from datetime import datetime, timedelta
from .base import BaseAgent


class ParalegalBot(BaseAgent):
    """
    Automates business formation paperwork and compliance tracking.
    
    Capabilities:
    - Business formation checklist
    - Document generation from templates
    - Filing deadline tracking
    - Compliance calendar
    - EIN application assistance
    - State registration guidance
    - License tracking
    """
    
    def __init__(self, llm_client, config: Dict):
        super().__init__(
            name="Paralegal Bot",
            role="Business Formation & Compliance",
            llm_client=llm_client,
            config=config
        )
        
    def analyze(self, context: Dict) -> Dict:
        """Analyze business formation requirements."""
        business_name = context.get('business_name')
        state = context.get('state', 'Delaware')
        entity_type = context.get('entity_type', 'LLC')
        industry = context.get('industry', 'Technology')
        
        # State-specific requirements
        state_requirements = self._get_state_requirements(state, entity_type)
        
        # Industry-specific licenses
        industry_licenses = self._get_industry_licenses(industry, state)
        
        # Estimated timeline
        timeline = self._estimate_timeline(state, entity_type)
        
        return {
            'business_name': business_name,
            'state': state,
            'entity_type': entity_type,
            'industry': industry,
            'state_requirements': state_requirements,
            'industry_licenses': industry_licenses,
            'estimated_timeline': timeline,
            'estimated_costs': self._estimate_costs(state, entity_type),
            'recommendations': [
                f"Form {entity_type} in {state}",
                "Obtain EIN from IRS (free, online)",
                "Register for state taxes",
                "Setup registered agent service",
                "Create operating agreement",
                "Open business bank account",
                "File beneficial ownership report with FinCEN"
            ]
        }
    
    def execute(self, task: Dict) -> Dict:
        """Execute formation and compliance tasks."""
        task_type = task.get('type')
        
        if task_type == 'generate_checklist':
            return self._generate_checklist(task)
        elif task_type == 'generate_documents':
            return self._generate_documents(task)
        elif task_type == 'ein_application':
            return self._ein_application(task)
        elif task_type == 'state_registration':
            return self._state_registration(task)
        elif task_type == 'compliance_calendar':
            return self._compliance_calendar(task)
        elif task_type == 'track_licenses':
            return self._track_licenses(task)
        else:
            return {'success': False, 'error': f'Unknown task type: {task_type}'}
    
    def _get_state_requirements(self, state: str, entity_type: str) -> List[Dict]:
        """Get state-specific formation requirements."""
        # Simplified - in production, this would query a comprehensive database
        base_requirements = [
            {
                'item': f'File Articles of {\"Organization\" if entity_type == \"LLC\" else \"Incorporation\"}',
                'authority': f'{state} Secretary of State',
                'method': 'Online or mail',
                'timeline': '1-5 business days'
            },
            {
                'item': 'Appoint Registered Agent',
                'authority': 'Required by state',
                'method': 'Include in formation documents',
                'timeline': 'Same day'
            },
            {
                'item': 'File Initial Report',
                'authority': f'{state} Secretary of State',
                'method': 'Online',
                'timeline': 'Within 90 days of formation'
            }
        ]
        
        return base_requirements
    
    def _get_industry_licenses(self, industry: str, state: str) -> List[Dict]:
        """Get industry-specific license requirements."""
        licenses = {
            'Technology': [
                {'license': 'Business License', 'level': 'City/County', 'renewal': 'Annual'},
                {'license': 'Sales Tax Permit', 'level': 'State', 'renewal': 'N/A'}
            ],
            'Food Service': [
                {'license': 'Food Service License', 'level': 'County Health Dept', 'renewal': 'Annual'},
                {'license': 'Food Handler Permit', 'level': 'County', 'renewal': 'Annual'},
                {'license': 'Business License', 'level': 'City', 'renewal': 'Annual'}
            ],
            'Healthcare': [
                {'license': 'Professional License', 'level': 'State Board', 'renewal': 'Annual'},
                {'license': 'DEA Registration', 'level': 'Federal', 'renewal': 'Every 3 years'},
                {'license': 'Business License', 'level': 'City', 'renewal': 'Annual'}
            ]
        }
        
        return licenses.get(industry, [{'license': 'Business License', 'level': 'City', 'renewal': 'Annual'}])
    
    def _estimate_timeline(self, state: str, entity_type: str) -> Dict:
        """Estimate formation timeline."""
        return {
            'name_availability_check': '1 day',
            'file_formation_documents': '1-5 business days',
            'obtain_ein': 'Same day (online)',
            'open_bank_account': '1-2 weeks',
            'register_state_taxes': '1-3 business days',
            'obtain_licenses': '2-4 weeks',
            'total_estimate': '4-6 weeks'
        }
    
    def _estimate_costs(self, state: str, entity_type: str) -> Dict:
        """Estimate formation costs."""
        # Simplified - actual costs vary by state
        costs = {
            'state_filing_fee': '$100-$500',
            'registered_agent': '$100-$300/year',
            'ein_application': 'Free',
            'operating_agreement': '$0 (DIY) - $500 (attorney)',
            'business_licenses': '$50-$500',
            'total_estimate': '$250-$1,800 first year'
        }
        return costs
    
    def _generate_checklist(self, task: Dict) -> Dict:
        """Generate comprehensive formation checklist."""
        business_name = task.get('business_name')
        state = task.get('state')
        entity_type = task.get('entity_type', 'LLC')
        
        checklist = [
            {
                'phase': 'Pre-Formation',
                'tasks': [
                    {'task': 'Choose business name', 'status': 'pending', 'priority': 'high'},
                    {'task': 'Check name availability', 'status': 'pending', 'priority': 'high'},
                    {'task': 'Reserve business name (optional)', 'status': 'pending', 'priority': 'medium'},
                    {'task': 'Determine business structure', 'status': 'complete', 'priority': 'high', 'value': entity_type},
                    {'task': 'Choose registered agent', 'status': 'pending', 'priority': 'high'}
                ]
            },
            {
                'phase': 'Formation',
                'tasks': [
                    {'task': f'File Articles of {\"Organization\" if entity_type == \"LLC\" else \"Incorporation\"}', 'status': 'pending', 'priority': 'high'},
                    {'task': 'Obtain EIN from IRS', 'status': 'pending', 'priority': 'high'},
                    {'task': 'Create Operating Agreement', 'status': 'pending', 'priority': 'high'},
                    {'task': 'File beneficial ownership report (FinCEN)', 'status': 'pending', 'priority': 'high'},
                    {'task': 'Register for state taxes', 'status': 'pending', 'priority': 'high'}
                ]
            },
            {
                'phase': 'Post-Formation',
                'tasks': [
                    {'task': 'Open business bank account', 'status': 'pending', 'priority': 'high'},
                    {'task': 'Obtain business licenses', 'status': 'pending', 'priority': 'medium'},
                    {'task': 'Setup bookkeeping system', 'status': 'pending', 'priority': 'medium'},
                    {'task': 'Get business insurance', 'status': 'pending', 'priority': 'medium'},
                    {'task': 'File initial report', 'status': 'pending', 'priority': 'medium'}
                ]
            },
            {
                'phase': 'Ongoing Compliance',
                'tasks': [
                    {'task': 'File annual report', 'status': 'pending', 'priority': 'high', 'frequency': 'annual'},
                    {'task': 'Renew business licenses', 'status': 'pending', 'priority': 'high', 'frequency': 'annual'},
                    {'task': 'Update beneficial ownership', 'status': 'pending', 'priority': 'high', 'frequency': 'as needed'},
                    {'task': 'File tax returns', 'status': 'pending', 'priority': 'high', 'frequency': 'annual'},
                    {'task': 'Hold annual meeting', 'status': 'pending', 'priority': 'medium', 'frequency': 'annual'}
                ]
            }
        ]
        
        return {
            'success': True,
            'business_name': business_name,
            'state': state,
            'entity_type': entity_type,
            'checklist': checklist,
            'total_tasks': sum(len(phase['tasks']) for phase in checklist),
            'high_priority_tasks': sum(1 for phase in checklist for task in phase['tasks'] if task['priority'] == 'high')
        }
    
    def _generate_documents(self, task: Dict) -> Dict:
        """Generate formation documents from templates."""
        business_name = task.get('business_name')
        state = task.get('state')
        entity_type = task.get('entity_type', 'LLC')
        members = task.get('members', [])
        
        documents = [
            {
                'name': f'Articles of {\"Organization\" if entity_type == \"LLC\" else \"Incorporation\"}',
                'description': 'Legal document to form the business',
                'template_available': True,
                'requires_filing': True,
                'filing_authority': f'{state} Secretary of State'
            },
            {
                'name': 'Operating Agreement',
                'description': 'Internal rules and ownership structure',
                'template_available': True,
                'requires_filing': False,
                'note': 'Keep with business records'
            },
            {
                'name': 'EIN Application (Form SS-4)',
                'description': 'Apply for Employer Identification Number',
                'template_available': True,
                'requires_filing': True,
                'filing_authority': 'IRS',
                'online_filing': 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online'
            },
            {
                'name': 'Beneficial Ownership Report',
                'description': 'Report company ownership to FinCEN',
                'template_available': True,
                'requires_filing': True,
                'filing_authority': 'FinCEN',
                'deadline': 'Within 90 days of formation',
                'online_filing': 'https://boiefiling.fincen.gov/'
            }
        ]
        
        return {
            'success': True,
            'documents': documents,
            'instructions': [
                "1. Review each document template",
                "2. Fill in business information",
                "3. Have all members review and sign",
                "4. File required documents with authorities",
                "5. Keep copies in business records",
                "6. Store in Nextcloud for team access"
            ],
            'document_storage': {
                'location': 'Nextcloud → Business Documents',
                'folders': [
                    'Formation Documents',
                    'Operating Agreements',
                    'Tax Documents',
                    'Licenses & Permits',
                    'Contracts',
                    'Meeting Minutes'
                ]
            }
        }
    
    def _ein_application(self, task: Dict) -> Dict:
        """Guide through EIN application process."""
        business_name = task.get('business_name')
        entity_type = task.get('entity_type', 'LLC')
        responsible_party = task.get('responsible_party', {})
        
        return {
            'success': True,
            'application_method': 'Online (recommended)',
            'url': 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online',
            'requirements': [
                'Valid Taxpayer Identification Number (SSN, ITIN, or EIN)',
                'Legal business name',
                'Business address',
                'Responsible party information',
                'Business start date',
                'Number of employees (can be 0)'
            ],
            'steps': [
                "1. Visit IRS EIN online application",
                "2. Select entity type: " + entity_type,
                "3. Enter business information",
                "4. Enter responsible party details",
                "5. Specify reason for applying",
                "6. Review and submit",
                "7. Receive EIN immediately",
                "8. Download and print confirmation letter",
                "9. Store EIN securely in Bitwarden"
            ],
            'timeline': 'Immediate (online) or 4-6 weeks (mail)',
            'cost': 'Free',
            'important_notes': [
                'You can only apply once per day per responsible party',
                'EIN is permanent - no need to reapply if business changes',
                'Keep EIN confidential - treat like SSN',
                'Needed for: bank account, taxes, hiring employees'
            ]
        }
    
    def _state_registration(self, task: Dict) -> Dict:
        """Guide through state registration process."""
        state = task.get('state')
        business_name = task.get('business_name')
        entity_type = task.get('entity_type', 'LLC')
        
        return {
            'success': True,
            'state': state,
            'registrations_required': [
                {
                    'name': 'Business Formation',
                    'authority': f'{state} Secretary of State',
                    'website': f'https://sos.{state.lower()}.gov',
                    'timeline': '1-5 business days',
                    'cost': '$100-$500 (varies by state)'
                },
                {
                    'name': 'State Tax Registration',
                    'authority': f'{state} Department of Revenue',
                    'purpose': 'Sales tax, employer taxes',
                    'timeline': '1-3 business days',
                    'cost': 'Free'
                },
                {
                    'name': 'Unemployment Insurance',
                    'authority': f'{state} Workforce Commission',
                    'required_if': 'You have employees',
                    'timeline': '1-2 weeks',
                    'cost': 'Varies'
                },
                {
                    'name': 'Workers Compensation',
                    'authority': 'Private insurance or state fund',
                    'required_if': 'You have employees',
                    'timeline': '1-2 weeks',
                    'cost': 'Based on payroll and risk'
                }
            ],
            'instructions': [
                f"1. Visit {state} Secretary of State website",
                "2. Search for business name availability",
                "3. Complete online formation application",
                "4. Pay filing fee",
                "5. Receive confirmation and file number",
                "6. Register for state taxes",
                "7. Obtain any required state licenses"
            ]
        }
    
    def _compliance_calendar(self, task: Dict) -> Dict:
        """Generate compliance calendar with deadlines."""
        formation_date = task.get('formation_date', datetime.now())
        state = task.get('state')
        entity_type = task.get('entity_type', 'LLC')
        
        if isinstance(formation_date, str):
            formation_date = datetime.fromisoformat(formation_date)
        
        # Calculate key deadlines
        deadlines = [
            {
                'task': 'File Beneficial Ownership Report',
                'deadline': (formation_date + timedelta(days=90)).strftime('%Y-%m-%d'),
                'authority': 'FinCEN',
                'priority': 'high',
                'penalty': 'Up to $10,000 fine'
            },
            {
                'task': 'Obtain EIN',
                'deadline': (formation_date + timedelta(days=30)).strftime('%Y-%m-%d'),
                'authority': 'IRS',
                'priority': 'high',
                'note': 'Needed for bank account'
            },
            {
                'task': 'File Initial Report',
                'deadline': (formation_date + timedelta(days=90)).strftime('%Y-%m-%d'),
                'authority': f'{state} Secretary of State',
                'priority': 'high',
                'penalty': 'Late fees'
            },
            {
                'task': 'File Annual Report',
                'deadline': (formation_date.replace(year=formation_date.year + 1)).strftime('%Y-%m-%d'),
                'authority': f'{state} Secretary of State',
                'priority': 'high',
                'frequency': 'Annual',
                'penalty': 'Late fees, possible dissolution'
            },
            {
                'task': 'File Tax Return',
                'deadline': f'{formation_date.year + 1}-03-15' if entity_type == 'LLC' else f'{formation_date.year + 1}-04-15',
                'authority': 'IRS',
                'priority': 'high',
                'frequency': 'Annual',
                'penalty': 'Penalties and interest'
            },
            {
                'task': 'Renew Business Licenses',
                'deadline': (formation_date.replace(year=formation_date.year + 1)).strftime('%Y-%m-%d'),
                'authority': 'City/County',
                'priority': 'medium',
                'frequency': 'Annual',
                'note': 'Varies by jurisdiction'
            }
        ]
        
        return {
            'success': True,
            'formation_date': formation_date.strftime('%Y-%m-%d'),
            'deadlines': sorted(deadlines, key=lambda x: x['deadline']),
            'reminders': [
                'Set calendar reminders 30 days before each deadline',
                'Review compliance calendar monthly',
                'Update calendar when regulations change',
                'Keep proof of filing for all submissions'
            ],
            'automation': {
                'note': 'Calendar can be exported to Google Calendar or Outlook',
                'notifications': 'Email reminders 30, 14, and 7 days before deadline'
            }
        }
    
    def _track_licenses(self, task: Dict) -> Dict:
        """Track business licenses and renewals."""
        licenses = task.get('licenses', [])
        
        return {
            'success': True,
            'licenses': licenses,
            'tracking_system': {
                'location': 'Nextcloud → Business Documents → Licenses',
                'fields': [
                    'License name',
                    'Issuing authority',
                    'License number',
                    'Issue date',
                    'Expiration date',
                    'Renewal process',
                    'Cost',
                    'Status'
                ]
            },
            'renewal_reminders': [
                '90 days before expiration',
                '60 days before expiration',
                '30 days before expiration',
                '14 days before expiration'
            ],
            'best_practices': [
                'Scan and store digital copies',
                'Set renewal reminders',
                'Budget for renewal costs',
                'Review requirements annually',
                'Keep proof of renewal'
            ]
        }
    
    def validate(self, result: Dict) -> Dict:
        """Validate formation and compliance status."""
        checks = {
            'checklist_generated': False,
            'documents_prepared': False,
            'ein_obtained': False,
            'state_registered': False,
            'beneficial_ownership_filed': False,
            'bank_account_opened': False,
            'licenses_obtained': False,
            'compliance_calendar_setup': False
        }
        
        return {
            'valid': False,
            'checks': checks,
            'manual_verification_required': True,
            'verification_steps': [
                "1. Review formation checklist completion",
                "2. Verify EIN confirmation letter received",
                "3. Check state filing confirmation",
                "4. Confirm beneficial ownership report filed",
                "5. Verify bank account opened",
                "6. Check all required licenses obtained",
                "7. Confirm compliance calendar is active",
                "8. Review all documents stored in Nextcloud"
            ],
            'ongoing_compliance': [
                'Review compliance calendar monthly',
                'File annual reports on time',
                'Renew licenses before expiration',
                'Update beneficial ownership as needed',
                'Hold required annual meetings',
                'Maintain corporate formalities'
            ]
        }
