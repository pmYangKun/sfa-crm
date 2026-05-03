'use client';

import CustomersPage from '@/app/(authenticated)/customers/page';

export default function MobileCustomersPage() {
  return (
    <div style={{ padding: 12, overflowX: 'auto' }}>
      <CustomersPage />
    </div>
  );
}
