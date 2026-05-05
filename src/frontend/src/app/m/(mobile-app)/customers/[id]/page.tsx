'use client';

import CustomerDetailPage from '@/app/(authenticated)/customers/[id]/page';

export default function MobileCustomerDetailPage() {
  return (
    <div style={{ padding: 12 }}>
      <CustomerDetailPage />
    </div>
  );
}
