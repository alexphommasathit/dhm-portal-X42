#!/bin/bash

# Script to deploy Supabase Edge Functions for the P&P Document system

# Ensure supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Error: Supabase CLI is not installed"
    echo "Please install it by following the instructions at:"
    echo "https://supabase.com/docs/guides/cli/getting-started"
    exit 1
fi

# Check if logged in
echo "Verifying Supabase CLI login status..."
if ! supabase status > /dev/null 2>&1; then
    echo "Please log in to Supabase CLI first:"
    echo "supabase login"
    exit 1
fi

# Check for environment variables
echo "Checking for required environment variables..."

# Required variables
required_vars=("OPENAI_API_KEY" "SUPABASE_URL" "SUPABASE_ANON_KEY")
missing_vars=0

for var in "${required_vars[@]}"; do
    if [ -z "$(supabase secrets list 2>/dev/null | grep "^$var=")" ]; then
        echo "⚠️ Missing environment variable: $var"
        missing_vars=1
    fi
done

# Optional variables
optional_vars=("OPENAI_ORG_ID" "ANTHROPIC_API_KEY")
for var in "${optional_vars[@]}"; do
    if [ -z "$(supabase secrets list 2>/dev/null | grep "^$var=")" ]; then
        echo "ℹ️ Optional environment variable not set: $var"
    fi
done

if [ $missing_vars -eq 1 ]; then
    echo "Please set the required environment variables using:"
    echo "supabase secrets set OPENAI_API_KEY=sk-your-api-key"
    echo "supabase secrets set SUPABASE_URL=your-project-url"
    echo "supabase secrets set SUPABASE_ANON_KEY=your-anon-key"
    
    echo "\nOptional variables for enhanced functionality:"
    echo "supabase secrets set OPENAI_ORG_ID=org-your-org-id # Required for HIPAA compliance"
    echo "supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-api-key # Required for Claude models"
    
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Deploy all functions
echo "Deploying policy-upload function..."
supabase functions deploy policy-upload
UPLOAD_RESULT=$?

echo "Deploying policy-parser function..."
supabase functions deploy policy-parser
PARSER_RESULT=$?

echo "Deploying policy-embed function..."
supabase functions deploy policy-embed
EMBED_RESULT=$?

echo "Deploying askPolicyQa function..."
supabase functions deploy askPolicyQa
QA_RESULT=$?

# Check deployment results
if [ $UPLOAD_RESULT -eq 0 ] && [ $PARSER_RESULT -eq 0 ] && [ $EMBED_RESULT -eq 0 ] && [ $QA_RESULT -eq 0 ]; then
    echo "✅ All functions deployed successfully"
    echo ""
    echo "To test the upload function, use:"
    echo "curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/policy-upload -H \"Authorization: Bearer SUPABASE_AUTH_TOKEN\" -F \"file=@path/to/file.pdf\" -F \"title=Test Document\""
    echo ""
    echo "To test the parser function, use:"
    echo "curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/policy-parser -H \"Authorization: Bearer SUPABASE_AUTH_TOKEN\" -H \"Content-Type: application/json\" -d '{\"documentId\":\"YOUR_DOC_ID\",\"filePath\":\"path/in/storage.pdf\"}'"
    echo ""
    echo "To test the embed function, use:"
    echo "curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/policy-embed -H \"Authorization: Bearer SUPABASE_AUTH_TOKEN\" -H \"Content-Type: application/json\" -d '{\"documentId\":\"YOUR_DOC_ID\"}'"
    echo ""
    echo "To test the QA function, use:"
    echo "curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/askPolicyQa -H \"Authorization: Bearer SUPABASE_AUTH_TOKEN\" -H \"Content-Type: application/json\" -d '{\"query\":\"What is the policy on vacation time?\",\"model\":\"gpt-4\"}'"
    echo ""
    echo "Available models for the QA function:"
    echo "- gpt-4 (Default)"
    echo "- gpt-3.5-turbo"
    echo "- claude-3-opus (requires ANTHROPIC_API_KEY)"
    echo "- claude-3-sonnet"
    echo "- claude-3-haiku"
else
    echo "⚠️ Some functions failed to deploy:"
    [ $UPLOAD_RESULT -ne 0 ] && echo "❌ policy-upload deployment failed"
    [ $PARSER_RESULT -ne 0 ] && echo "❌ policy-parser deployment failed"
    [ $EMBED_RESULT -ne 0 ] && echo "❌ policy-embed deployment failed"
    [ $QA_RESULT -ne 0 ] && echo "❌ askPolicyQa deployment failed"
    
    [ $UPLOAD_RESULT -eq 0 ] && echo "✅ policy-upload deployment succeeded"
    [ $PARSER_RESULT -eq 0 ] && echo "✅ policy-parser deployment succeeded"
    [ $EMBED_RESULT -eq 0 ] && echo "✅ policy-embed deployment succeeded"
    [ $QA_RESULT -eq 0 ] && echo "✅ askPolicyQa deployment succeeded"
fi

echo "Done" 