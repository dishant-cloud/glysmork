import uuid
from sqlalchemy import Column, Integer, String, Boolean, Float, Text, ForeignKey, TIMESTAMP, func, JSON
from sqlalchemy.orm import relationship
from onboarding_service.database import Base

class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    # Matching existing auth system which uses Integer for ID
    user_id = Column(Integer, primary_key=True)
    human_summary = Column(Text, nullable=True) # The warmly generated human-readable bio
    hard_filters = Column(JSON, nullable=False)
    who_i_am = Column(JSON, nullable=False)
    who_i_want = Column(JSON, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

class AttributeRegistry(Base):
    __tablename__ = "attribute_registry"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attribute_name = Column(Text, nullable=False)
    canonical_value = Column(Text, nullable=False)
    aliases = Column(JSON, default=list) # Using JSON for list since SQLite lacks ARRAY
    usage_count = Column(Integer, default=1)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class Bucket(Base):
    __tablename__ = "buckets"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(Text, unique=True, nullable=False)
    description = Column(Text, nullable=False)
    guidelines = Column(Text, nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class MatchResult(Base):
    __tablename__ = "match_results"
    
    user_a_id = Column(Integer, primary_key=True)
    user_b_id = Column(Integer, primary_key=True)
    score = Column(Float)
    zone = Column(Text)
    computed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class MatchFeedback(Base):
    __tablename__ = "match_feedback"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_a_id = Column(Integer)
    user_b_id = Column(Integer)
    rating = Column(Integer)
    talk_duration = Column(Integer)
    reconnected = Column(Boolean, default=False)
    blocked = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
