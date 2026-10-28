from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class CandidateOut(BaseModel):
    id: str
    analysis_id: str
    filename: str
    name: str
    email: str | None
    skills: list[str]
    missing_skills: list[str]
    entities: dict
    projects: list[str]
    education: str | None
    experience_details: list[dict]
    semantic_score: int
    keyword_score: int
    experience_score: int
    overall_score: int
    recommendation: str
    insight: str
    requires_manual_name_entry: bool = False
    is_shortlisted: bool = False
    shortlist_source: Literal["automatic", "manual"] = "automatic"
    email_sent: bool = False
    email_sent_at: datetime | None = None
    call_scheduled: bool = False
    call_scheduled_at: datetime | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


class AnalysisOut(BaseModel):
    id: str
    job_id: str | None = None
    run_number: int | None = None
    job_snapshot: dict | None = None
    job_title: str | None
    requirements: dict
    status: str
    error: str | None
    created_at: datetime | None
    completed_at: datetime | None
    candidate_count: int = 0
    candidates: list[CandidateOut] = Field(default_factory=list)


class CompletedResumeOut(BaseModel):
    id: str
    filename: str
    candidate_name: str
    ats_score: int


class CurrentResumeState(BaseModel):
    filename: str | None
    candidate_name: str | None


class AnalysisStatusOut(BaseModel):
    analysis_id: str
    status: str
    phase: str | None
    current_stage: str
    total: int
    completed: int
    phase_completed: int
    phase_total: int
    current_resume: CurrentResumeState | None
    completed_resumes: list[CompletedResumeOut] = Field(default_factory=list)
    started_at: datetime
    current_resume_started_at: datetime | None
    completed_at: datetime | None
    error: str | None = None

class JobDescriptionExtractOut(BaseModel):
    text: str
    filename: str
    pages: int


class ShortlistUpdateIn(BaseModel):
    """Update candidate shortlist status."""
    is_shortlisted: bool
    notes: str | None = None


class ShortlistThresholdIn(BaseModel):
    threshold: int = Field(ge=0, le=100)


class CandidateIdsIn(BaseModel):
    candidate_ids: list[str] = Field(min_length=1, max_length=1000)


class JobCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    department: str | None = Field(default=None, max_length=150)
    location: str | None = Field(default=None, max_length=255)
    employment_type: str | None = Field(default=None, max_length=50)
    work_mode: str | None = Field(default=None, max_length=50)
    experience_level: str | None = Field(default=None, max_length=100)
    salary_range: str | None = Field(default=None, max_length=100)
    openings: int = Field(default=1, ge=1, le=10000)
    application_deadline: str | None = Field(default=None, pattern=r"^$|^\d{4}-\d{2}-\d{2}$")
    priority: Literal["Low", "Medium", "High"] = "Medium"
    job_description: str = Field(min_length=20, max_length=50000)
    required_skills: list[str] = Field(default_factory=list, max_length=100)
    preferred_skills: list[str] = Field(default_factory=list, max_length=100)
    minimum_experience_years: int | None = Field(default=None, ge=0, le=80)
    education_requirement: str | None = Field(default=None, max_length=255)
    company_id: str | None = None
    status: Literal["draft", "open"] = "open"


class JobUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    department: str | None = Field(default=None, max_length=150)
    location: str | None = Field(default=None, max_length=255)
    employment_type: str | None = Field(default=None, max_length=50)
    work_mode: str | None = Field(default=None, max_length=50)
    experience_level: str | None = Field(default=None, max_length=100)
    salary_range: str | None = Field(default=None, max_length=100)
    openings: int | None = Field(default=None, ge=1, le=10000)
    application_deadline: str | None = Field(default=None, pattern=r"^$|^\d{4}-\d{2}-\d{2}$")
    priority: Literal["Low", "Medium", "High"] | None = None
    job_description: str | None = Field(default=None, min_length=20, max_length=50000)
    required_skills: list[str] | None = Field(default=None, max_length=100)
    preferred_skills: list[str] | None = Field(default=None, max_length=100)
    minimum_experience_years: int | None = Field(default=None, ge=0, le=80)
    education_requirement: str | None = Field(default=None, max_length=255)
    company_id: str | None = None
    status: Literal["draft", "open", "closed"] | None = None


class JobOut(BaseModel):
    id: str
    owner_user_id: str
    owner_name: str | None = None
    company_id: str | None
    company_name: str | None = None
    title: str
    department: str | None
    location: str | None
    employment_type: str | None
    work_mode: str | None
    experience_level: str | None
    salary_range: str | None
    openings: int
    application_deadline: str | None
    priority: str
    job_description: str
    required_skills: list[str]
    preferred_skills: list[str]
    minimum_experience_years: int | None
    education_requirement: str | None
    status: str
    shortlist_threshold: int = 75
    analysis_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmailTemplateIn(BaseModel):
    """Email template for sending to candidates."""
    subject: str
    body: str
    html_body: str | None = None


class SendEmailIn(BaseModel):
    """Request to send email to candidate(s)."""
    recipient_ids: list[str] | None = None  # Specific candidate IDs, or None for all shortlisted
    template_type: str = "procedure"  # procedure, rejection, custom
    custom_subject: str | None = None
    custom_body: str | None = None
    custom_html_body: str | None = None


class EmailResponseOut(BaseModel):
    """Response from email sending."""
    success: bool
    message: str
    sent_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0
    errors: list[dict] = Field(default_factory=list)


class ShortlistedCandidateOut(BaseModel):
    """Candidate in shortlist with additional status info."""
    id: str
    name: str
    email: str | None
    overall_score: int
    recommendation: str
    skills: list[str]
    education: str | None
    is_shortlisted: bool
    email_sent: bool
    email_sent_at: datetime | None
    call_scheduled: bool
    call_scheduled_at: datetime | None
    notes: str | None

    model_config = {"from_attributes": True}


class CallProcedureIn(BaseModel):
    """Schedule a call/procedure for candidate."""
    candidate_id: str
    scheduled_at: datetime | None = None
    notes: str | None = None


class FilterCriteriaIn(BaseModel):
    """Filter criteria for candidates."""
    min_score: int | None = None
    max_score: int | None = None
    recommendation: str | None = None  # "Strong Match", "Good Match", etc.
    skills_filter: list[str] | None = None
    is_shortlisted: bool | None = None
    email_sent: bool | None = None


class UserBase(BaseModel):
    full_name: str
    email: str
    module: str = "admin_tpo"
    role: str = "tpo"
    phone: str | None = None
    company_name: str | None = None
    company_identifier: str | None = None
    company_email: str | None = None
    company_phone: str | None = None
    company_address: str | None = None
    company_website: str | None = None
    designation: str | None = None
    institution_name: str | None = None
    institution_identifier: str | None = None
    student_id: str | None = None


class UserOut(UserBase):
    id: str
    is_approved: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginIn(BaseModel):
    module: str
    email: str
    password: str


class RegisterIn(UserBase):
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class AuthTokenOut(BaseModel):
    access_token: str
    token_type: str = "Bearer"


class AuthResponseOut(BaseModel):
    token: AuthTokenOut
    user: UserOut


class RecruiterValidationIn(BaseModel):
    is_verified: bool


class NoticeIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    audience: str = "All"
    status: str = "draft"
    expires_at: datetime | None = None


class NoticeUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, min_length=1)
    audience: str | None = None
    status: str | None = None
    expires_at: datetime | None = None


class StudentIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    student_id: str | None = None
    phone: str | None = None
    department: str | None = None
    graduation_year: int | None = None
    headline: str | None = None
    location: str | None = None
    cgpa: str | None = None
    backlog_count: int = 0
    skills: str | None = None
    eligibility_status: str = "review"
    placement_status: str = "not applied"


class StudentUpdateIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    student_id: str | None = None
    phone: str | None = None
    department: str | None = None
    graduation_year: int | None = None
    headline: str | None = None
    location: str | None = None
    cgpa: str | None = None
    backlog_count: int | None = None
    skills: str | None = None
    eligibility_status: str | None = None
    placement_status: str | None = None


class CompanyIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sector: str | None = None
    website: str | None = None
    description: str | None = None
    job_count: int = 0
    status: str = "active"


class CompanyUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    sector: str | None = None
    website: str | None = None
    description: str | None = None
    job_count: int | None = None
    status: str | None = None


class EligibilityIn(BaseModel):
    candidate_id: str
    job_id: str
    status: str = "review"
    notes: str | None = None


class EligibilityUpdateIn(BaseModel):
    status: str | None = None
    notes: str | None = None
    final_result: str | None = None
    breakdown: list[dict] | None = None


class NotificationIn(BaseModel):
    title: str = Field(default="Notification", min_length=1, max_length=255)
    message: str = ""
    audience: str = "All"
