import { NextResponse } from 'next/server';
import { seedQapiWorkflow } from '@/app/workflows/manual-seed';

export async function GET() {
  try {
    console.log('Starting seed workflow process...');
    const templateId = await seedQapiWorkflow();
    
    if (!templateId) {
      console.error('Seed function completed but no template ID was returned');
      return NextResponse.json(
        {
          success: false,
          message: 'Seed function completed but failed to create template',
        },
        { status: 500 }
      );
    }
    
    console.log('Seed completed successfully with template ID:', templateId);
    return NextResponse.json({
      success: true,
      message: 'QAPI workflow template seeded successfully',
      templateId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in seed workflow API:', errorMessage);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to seed workflow template',
        error: errorMessage
      },
      { status: 500 }
    );
  }
} 