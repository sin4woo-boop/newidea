import Link from 'next/link';
import { Button, Card } from '@/components/ui';

export default function HomePage() {
  return (
    <div className="space-y-4">
      <Card className="space-y-3 bg-gradient-to-b from-white to-muted">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Mobile PWA Prototype</p>
        <h1 className="text-2xl font-semibold">고미술 진위/위작 리스크 스크리닝</h1>
        <p className="text-sm text-muted-foreground">진위 판정이 아닌 참고용 리스크 스코어와 촬영 가이드를 제공합니다.</p>
        <Link href="/new" className="block">
          <Button className="w-full justify-center">작품 사진 촬영/업로드</Button>
        </Link>
      </Card>
      <Card>
        <h2 className="mb-2 font-medium">기능</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>촬영 품질 체크(블러/밝기/해상도)</li>
          <li>Google Vision OCR 연동</li>
          <li>룰 기반 리스크 스코어와 근거 제공</li>
          <li>내 접수함/관리자 리뷰</li>
        </ul>
      </Card>
    </div>
  );
}
