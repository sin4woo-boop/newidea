import { Category } from './types';

const common = ['정면 전체컷', '낙관/서명 근접컷', '손상 부위 근접컷'];

const byCategory: Record<Category, string[]> = {
  도자: ['바닥 굽/명문 컷', '유약 표면 반사광 컷'],
  서화: ['종이 질감 접사', '배접/뒷면 컷'],
  회화: ['캔버스 결/물감층 접사', '프레임 및 뒷면 라벨 컷'],
  기타: ['식별 마크 접사', '구성품 전체컷']
};

export function getChecklist(category: Category) {
  return [...common, ...byCategory[category]];
}
