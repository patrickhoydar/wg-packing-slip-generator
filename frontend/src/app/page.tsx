'use client';

import Sidebar from '../components/Sidebar';
import ElementsPanel from '../components/ElementsPanel';
import PreviewPanel from '../components/PreviewPanel';
import { dummyPackingSlip } from '../data/dummyData';

export default function Home() {
  return (
    <div className="page-wrapper h-screen bg-gray-100 flex">
      <Sidebar>
        <ElementsPanel />
      </Sidebar>
      
      <PreviewPanel packingSlip={dummyPackingSlip} />
    </div>
  );
}
