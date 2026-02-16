export type Category = '도자' | '서화' | '회화' | '기타';

export type QualityResult = {
  width: number;
  height: number;
  brightness: number;
  blurScore: number;
  isLowResolution: boolean;
  isTooDark: boolean;
  isTooBright: boolean;
  isBlurry: boolean;
  status: 'OK' | '재촬영 권장';
  guides: string[];
};

export type RiskLevel = '낮음' | '중간' | '높음';

export type OCRBlock = {
  text: string;
  confidence?: number;
  boundingBox?: { x: number; y: number }[];
};

export type CaseRecord = {
  id: string;
  createdAt: string;
  category: Category;
  imageUrl?: string;
  qualityResult: QualityResult;
  ocrText: string;
  ocrConfidence?: number;
  riskScore: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
  notes?: string;
  tags: string[];
};
