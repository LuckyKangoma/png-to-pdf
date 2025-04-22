import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster, toast } from "sonner";
import { useState } from "react";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm p-4 flex justify-between items-center border-b">
        <h2 className="text-xl font-semibold accent-text">PNG to PDF Converter</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md mx-auto">
          <Content />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const conversions = useQuery(api.files.listConversions);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const startConversion = useMutation(api.files.startConversion);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.includes('png')) {
      toast.error('Please select a PNG file');
      return;
    }

    try {
      setIsUploading(true);
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      await startConversion({ storageId, fileName: file.name });
      toast.success('Conversion started');
    } catch (error) {
      toast.error('Upload failed');
      console.error(error);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold accent-text mb-4">PNG to PDF Converter</h1>
        <Authenticated>
          <p className="text-xl text-slate-600">
            Convert your PNG files to PDF format
          </p>
        </Authenticated>
        <Unauthenticated>
          <p className="text-xl text-slate-600">Sign in to get started</p>
        </Unauthenticated>
      </div>

      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>

      <Authenticated>
        <div className="space-y-6">
          <div className="flex justify-center">
            <label className="cursor-pointer bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 transition">
              <span>{isUploading ? 'Uploading...' : 'Upload PNG'}</span>
              <input
                type="file"
                accept=".png"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>

          {conversions && conversions.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <h3 className="font-semibold">Your Conversions</h3>
              </div>
              <div className="divide-y">
                {conversions.map((conversion) => (
                  <ConversionItem key={conversion._id} conversion={conversion} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Authenticated>
    </div>
  );
}

function ConversionItem({ conversion }: { conversion: any }) {
  const pdfUrl = useQuery(api.files.getPdfUrl, { 
    pdfFileId: conversion.pdfFileId 
  });

  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div>
        <p className="font-medium">{conversion.fileName}</p>
        <p className="text-sm text-gray-500 capitalize">{conversion.status}</p>
      </div>
      {conversion.status === 'completed' && pdfUrl && (
        <a
          href={pdfUrl}
          download={conversion.fileName.replace('.png', '.pdf')}
          className="text-indigo-500 hover:text-indigo-600"
        >
          Download PDF
        </a>
      )}
    </div>
  );
}
