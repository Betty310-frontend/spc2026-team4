'use client';

import { useState } from 'react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle, Info, Terminal } from 'lucide-react';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</h2>
      <Separator className="mt-2" />
    </div>
  );
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-3 ${className ?? ''}`}>{children}</div>;
}

export default function UITestPage() {
  const [progressValue] = useState(65);
  const [switchOn, setSwitchOn] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <h1 className="text-xl font-bold tracking-tight">UI Components</h1>
          <p className="text-sm text-muted-foreground">팔레트 스위처는 좌측 상단에 있습니다</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-6 pt-10">

        {/* ─── Typography ─── */}
        <section>
          <SectionTitle>Typography</SectionTitle>
          <div className="space-y-3">
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight">Heading 1</h1>
            <h2 className="scroll-m-20 text-3xl font-bold tracking-tight">Heading 2</h2>
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">Heading 3</h3>
            <h4 className="scroll-m-20 text-xl font-semibold">Heading 4</h4>
            <p className="leading-7">본문 텍스트 — 일반 단락에서 사용됩니다. 가독성 높은 행간과 글자 크기를 갖습니다.</p>
            <p className="text-sm text-muted-foreground">Muted / 보조 텍스트 — 부가적인 설명이나 힌트에 사용됩니다.</p>
            <p className="text-xs text-muted-foreground">Small text — 캡션, 레이블 등에 사용됩니다.</p>
            <p className="font-mono text-sm bg-muted rounded px-2 py-1 w-fit">
              <code>inline code snippet</code>
            </p>
          </div>
        </section>

        {/* ─── Buttons ─── */}
        <section>
          <SectionTitle>Buttons</SectionTitle>
          <div className="space-y-4">
            <div>
              <p className="mb-3 text-xs text-muted-foreground">Variants</p>
              <Row>
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
              </Row>
            </div>
            <div>
              <p className="mb-3 text-xs text-muted-foreground">Sizes</p>
              <Row className="items-end">
                <Button size="lg">Large</Button>
                <Button size="default">Default</Button>
                <Button size="sm">Small</Button>
              </Row>
            </div>
            <div>
              <p className="mb-3 text-xs text-muted-foreground">States</p>
              <Row>
                <Button disabled>Disabled</Button>
                <Button variant="outline" disabled>Disabled Outline</Button>
              </Row>
            </div>
          </div>
        </section>

        {/* ─── Form Controls ─── */}
        <section>
          <SectionTitle>Form Controls</SectionTitle>
          <div className="grid gap-8 md:grid-cols-2">
            {/* Input & Textarea */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="demo-input">텍스트 입력</Label>
                <Input id="demo-input" placeholder="이름을 입력하세요" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-input-err">오류 상태</Label>
                <Input id="demo-input-err" placeholder="이메일" className="border-destructive focus-visible:ring-destructive" />
                <p className="text-xs text-destructive">올바른 이메일 형식이 아닙니다.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-textarea">텍스트 영역</Label>
                <Textarea id="demo-textarea" placeholder="내용을 입력하세요..." rows={3} />
              </div>
            </div>

            {/* Select, Checkbox, Radio, Switch */}
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label>선택 드롭다운</Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="항목을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="option1">옵션 1</SelectItem>
                    <SelectItem value="option2">옵션 2</SelectItem>
                    <SelectItem value="option3">옵션 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">체크박스</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="chk1" defaultChecked />
                    <Label htmlFor="chk1" className="font-normal">선택됨</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="chk2" />
                    <Label htmlFor="chk2" className="font-normal">선택 안됨</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="chk3" disabled />
                    <Label htmlFor="chk3" className="font-normal text-muted-foreground">비활성화</Label>
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">라디오 버튼</Label>
                <RadioGroup defaultValue="r1" className="space-y-1">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="r1" id="r1" />
                    <Label htmlFor="r1" className="font-normal">옵션 A</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="r2" id="r2" />
                    <Label htmlFor="r2" className="font-normal">옵션 B</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center gap-3">
                <Switch id="sw" checked={switchOn} onCheckedChange={setSwitchOn} />
                <Label htmlFor="sw" className="font-normal">
                  알림 {switchOn ? '켜짐' : '꺼짐'}
                </Label>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Data Display ─── */}
        <section>
          <SectionTitle>Data Display</SectionTitle>
          <div className="space-y-6">
            {/* Badges */}
            <div>
              <p className="mb-3 text-xs text-muted-foreground">Badge</p>
              <Row>
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </Row>
            </div>

            {/* Avatars */}
            <div>
              <p className="mb-3 text-xs text-muted-foreground">Avatar</p>
              <Row className="items-end">
                <Avatar size="lg">
                  <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <Avatar size="sm">
                  <AvatarFallback>AB</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
              </Row>
            </div>

            {/* Card */}
            <div>
              <p className="mb-3 text-xs text-muted-foreground">Card</p>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>프로젝트 현황</CardTitle>
                    <CardDescription>2026년 1분기 진행 상황</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">현재 3개의 스프린트가 완료되었으며, 4번째 스프린트가 진행 중입니다.</p>
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button size="sm">자세히 보기</Button>
                    <Button size="sm" variant="outline">편집</Button>
                  </CardFooter>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>통계</CardTitle>
                    <CardDescription>이번 달 주요 지표</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">완료된 작업</span>
                      <span className="font-semibold">24</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">진행 중</span>
                      <span className="font-semibold">8</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm font-medium">
                      <span>전체</span>
                      <span>32</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Feedback ─── */}
        <section>
          <SectionTitle>Feedback</SectionTitle>
          <div className="space-y-6">
            {/* Alerts */}
            <div className="space-y-3">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>안내</AlertTitle>
                <AlertDescription>시스템 점검이 오전 2시에 예정되어 있습니다.</AlertDescription>
              </Alert>
              <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle>알림</AlertTitle>
                <AlertDescription>새 버전(v2.1.0)이 배포되었습니다.</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>요청을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.</AlertDescription>
              </Alert>
              <Alert>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <AlertTitle>성공</AlertTitle>
                <AlertDescription>변경 사항이 성공적으로 저장되었습니다.</AlertDescription>
              </Alert>
            </div>

            {/* Progress */}
            <div>
              <p className="mb-3 text-xs text-muted-foreground">Progress</p>
              <div className="space-y-3">
                <div>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span>업로드 중...</span>
                    <span>{progressValue}%</span>
                  </div>
                  <Progress value={progressValue} className="h-2" />
                </div>
                <Progress value={100} className="h-2" />
                <Progress value={30} className="h-1" />
              </div>
            </div>

            {/* Skeleton */}
            <div>
              <p className="mb-3 text-xs text-muted-foreground">Skeleton (로딩 상태)</p>
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Navigation & Layout ─── */}
        <section>
          <SectionTitle>Navigation & Layout</SectionTitle>
          <div className="space-y-8">
            {/* Tabs */}
            <div>
              <p className="mb-3 text-xs text-muted-foreground">Tabs</p>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">개요</TabsTrigger>
                  <TabsTrigger value="analytics">분석</TabsTrigger>
                  <TabsTrigger value="settings">설정</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4">
                  <p className="text-sm text-muted-foreground">개요 탭의 내용입니다. 프로젝트 전반적인 현황을 보여줍니다.</p>
                </TabsContent>
                <TabsContent value="analytics" className="mt-4">
                  <p className="text-sm text-muted-foreground">분석 탭의 내용입니다. 상세 데이터와 차트를 표시합니다.</p>
                </TabsContent>
                <TabsContent value="settings" className="mt-4">
                  <p className="text-sm text-muted-foreground">설정 탭의 내용입니다. 구성 옵션을 변경할 수 있습니다.</p>
                </TabsContent>
              </Tabs>
            </div>

            {/* Accordion */}
            <div>
              <p className="mb-3 text-xs text-muted-foreground">Accordion</p>
              <Accordion type="single" collapsible className="w-full max-w-xl">
                <AccordionItem value="faq1">
                  <AccordionTrigger>서비스 이용 요금은 얼마인가요?</AccordionTrigger>
                  <AccordionContent>
                    기본 플랜은 무료로 제공되며, 프로 플랜은 월 9,900원부터 시작합니다.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="faq2">
                  <AccordionTrigger>결제 수단으로 무엇을 지원하나요?</AccordionTrigger>
                  <AccordionContent>
                    신용카드, 체크카드, 카카오페이, 네이버페이 등을 지원합니다.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="faq3">
                  <AccordionTrigger>환불 정책은 어떻게 되나요?</AccordionTrigger>
                  <AccordionContent>
                    결제일로부터 7일 이내 환불이 가능하며, 이미 사용한 서비스는 제외됩니다.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* ScrollArea */}
            <div>
              <p className="mb-3 text-xs text-muted-foreground">Scroll Area</p>
              <ScrollArea className="h-36 w-full max-w-xs rounded-lg border p-4">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="py-1 text-sm text-muted-foreground">
                    스크롤 항목 {i + 1} — 내용이 길어지면 스크롤이 활성화됩니다.
                  </div>
                ))}
              </ScrollArea>
            </div>
          </div>
        </section>

        {/* ─── Overlays ─── */}
        <section>
          <SectionTitle>Overlays</SectionTitle>
          <div className="space-y-6">
            <Row>
              {/* Dialog */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">다이얼로그 열기</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>정말 삭제하시겠습니까?</DialogTitle>
                    <DialogDescription>
                      이 작업은 취소할 수 없습니다. 데이터가 영구적으로 삭제됩니다.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline">취소</Button>
                    <Button variant="destructive">삭제</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">사이드 패널 열기</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>설정</SheetTitle>
                    <SheetDescription>계정 및 알림 설정을 변경합니다.</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label>이름</Label>
                      <Input placeholder="홍길동" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>이메일</Label>
                      <Input placeholder="user@example.com" type="email" />
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <Switch id="sheet-notif" />
                      <Label htmlFor="sheet-notif" className="font-normal">이메일 알림 수신</Label>
                    </div>
                    <Button className="w-full mt-4">저장</Button>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Tooltip */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">툴팁 호버</Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>마우스를 올리면 이 설명이 표시됩니다</p>
                </TooltipContent>
              </Tooltip>
            </Row>
          </div>
        </section>

      </main>
    </div>
  );
}
