import React from 'react';
import Breadcrumb from './Breadcrumb';

interface PageProps {
  title: string;
  children: React.ReactNode;
}

const Page: React.FC<PageProps> = ({ title, children }) => {
  return (
    <div>
      <div className="md:flex md:items-end md:justify-start">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">{title}</h1>
        </div>
        <div className=" mb-1 mt-4 flex-shrink-0 flex md:mt-0 md:ml-4">
          <Breadcrumb  />
        </div>
      </div>
      <div className="mt-4">
        {children}
      </div>
    </div>
  );
};

export default Page;
