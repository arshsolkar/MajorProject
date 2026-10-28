import { useState } from 'react'
import { Send, Copy, Check, AlertCircle } from 'lucide-react'
import { sendEmailToCandidates } from '../utils/api'

interface EmailTemplate {
  name: string
  subject: string
  body: string
}

const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  procedure: {
    name: 'Schedule Call/Procedure',
    subject: 'Next Steps in Your Application',
    body: `Dear [CANDIDATE_NAME],

Thank you for your interest in our organization! We are impressed with your qualifications and would like to move forward with the next steps.

We will be scheduling a call with you shortly to discuss the position and your background in more detail.

Looking forward to speaking with you soon!

Best regards,
Recruitment Team`
  },
  rejection: {
    name: 'Rejection Notice',
    subject: 'Application Status Update',
    body: `Dear [CANDIDATE_NAME],

Thank you for taking the time to apply for this position. We appreciate your interest in our organization.

After careful consideration, we have decided to move forward with other candidates whose background closely matches our current needs. We encourage you to apply for future positions that may be a better fit.

We wish you the best of luck in your career!

Best regards,
Recruitment Team`
  },
  custom: {
    name: 'Custom Message',
    subject: '',
    body: ''
  }
}

interface EmailPageProps {
  onSendEmail?: (template: any, recipients: string[]) => Promise<void>
}

export default function EmailPage({ onSendEmail }: EmailPageProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('procedure')
  const [subject, setSubject] = useState(EMAIL_TEMPLATES.procedure.subject)
  const [body, setBody] = useState(EMAIL_TEMPLATES.procedure.body)
  const [recipientEmails, setRecipientEmails] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleTemplateChange = (templateName: string) => {
    setSelectedTemplate(templateName)
    const template = EMAIL_TEMPLATES[templateName]
    setSubject(template.subject)
    setBody(template.body)
    setMessage(null)
  }

  const copyToClipboard = async () => {
    const fullEmail = `Subject: ${subject}\n\n${body}`
    await navigator.clipboard.writeText(fullEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSend = async () => {
    const emails = recipientEmails
      .split('\n')
      .map(e => e.trim())
      .filter(e => e && e.includes('@'))

    if (emails.length === 0) {
      setMessage({ type: 'error', text: 'Please enter at least one email address' })
      return
    }

    setSending(true)
    try {
      const result = await sendEmailToCandidates(
        undefined,
        selectedTemplate === 'custom' ? 'custom' : (selectedTemplate as any),
        selectedTemplate === 'custom' ? subject : undefined,
        selectedTemplate === 'custom' ? body : undefined
      )

      if (result.success) {
        setMessage({ type: 'success', text: `Emails sent successfully! (${result.sent_count} sent)` })
        setRecipientEmails('')
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to send emails' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error sending emails. Please try again.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Email Outreach</h1>
        <p className="text-gray-600 mt-2">Send emails to candidates with pre-built or custom templates</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Email Templates</h2>
          <div className="space-y-2">
            {Object.entries(EMAIL_TEMPLATES).map(([key, template]) => (
              <button
                key={key}
                onClick={() => handleTemplateChange(key)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  selectedTemplate === key
                    ? 'bg-blue-100 border-2 border-blue-500 text-blue-900'
                    : 'bg-gray-100 border-2 border-transparent text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="font-medium">{template.name}</div>
                <div className="text-sm opacity-75 truncate mt-1">{template.subject}</div>
              </button>
            ))}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Tip:</p>
                <p>Use [CANDIDATE_NAME] as a placeholder that will be replaced with actual candidate names</p>
              </div>
            </div>
          </div>
        </div>

        {/* Email Composer Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Message Alert */}
          {message && (
            <div className={`p-4 rounded-lg flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <Check className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="ml-2">{message.text}</span>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Email subject"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="Email body content"
            />
          </div>

          {/* Recipient Emails */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recipient Emails</label>
            <textarea
              value={recipientEmails}
              onChange={(e) => setRecipientEmails(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="Enter email addresses, one per line"
            />
            <p className="text-xs text-gray-500 mt-1">
              {recipientEmails.split('\n').filter(e => e.trim() && e.includes('@')).length} valid email(s)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Email
                </>
              )}
            </button>
            <button
              onClick={handleSend}
              disabled={sending || recipientEmails.trim() === ''}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Preview</h2>
        <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm space-y-2">
          <div>
            <span className="text-gray-600">To:</span>
            <span className="ml-2 text-gray-900">recipient@example.com</span>
          </div>
          <div>
            <span className="text-gray-600">Subject:</span>
            <span className="ml-2 text-gray-900">{subject}</span>
          </div>
          <div className="border-t border-gray-300 pt-4 mt-4 whitespace-pre-wrap text-gray-800">
            {body}
          </div>
        </div>
      </div>
    </div>
  )
}
