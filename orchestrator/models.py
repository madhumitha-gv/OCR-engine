"""ORM models for NeuralPress."""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(64), unique=True, index=True, nullable=False)
    email           = Column(String(256), unique=True, index=True, nullable=False)
    hashed_password = Column(String(256), nullable=False)
    display_name    = Column(String(128), nullable=True)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    runs = relationship("PipelineRun", back_populates="owner", cascade="all, delete-orphan")


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id                    = Column(Integer, primary_key=True, index=True)
    user_id               = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    image_filename        = Column(String(256), nullable=True)   # original filename
    image_path            = Column(String(512), nullable=True)   # path on disk
    noise_profile         = Column(String(32),  nullable=False)
    ocr_text              = Column(String(512), nullable=True)
    confidence            = Column(Float,       nullable=True)
    noise_profile_detected = Column(String(32), nullable=True)
    compressed_bytes      = Column(Text,        nullable=True)   # base64 payload
    original_size_bits    = Column(Integer,     nullable=True)
    compressed_size_bits  = Column(Integer,     nullable=True)
    compression_ratio     = Column(Float,       nullable=True)
    entropy               = Column(Float,       nullable=True)
    encoding_efficiency   = Column(Float,       nullable=True)
    num_symbols           = Column(Integer,     nullable=True)   # len(ocr_text.encode()) — needed for decompress
    huffman_tree          = Column(Text,        nullable=True)   # JSON string
    encoded_bits          = Column(Text,        nullable=True)   # bit string
    symbol_frequencies    = Column(Text,        nullable=True)   # JSON string
    pipeline_latency_ms   = Column(Float,       nullable=True)
    created_at            = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="runs")
