/**
 * OpenAI API Key Direct Validation Script
 * Reads .dev.vars and tests the key directly against OpenAI API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devVarsPath = path.resolve(__dirname, '../../.dev.vars');

// 1. Read .dev.vars
console.log('Reading .dev.vars from:', devVarsPath);
let apiKey = '';

try {
    const content = fs.readFileSync(devVarsPath, 'utf-8');
    const match = content.match(/OPENAI_API_KEY="(.+?)"/);
    if (match && match[1]) {
        apiKey = match[1];
        console.log('API Key found: ' + apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4));
    } else {
        console.error('Could not find OPENAI_API_KEY in .dev.vars');
        process.exit(1);
    }
} catch (error) {
    console.error('Error reading .dev.vars:', error.message);
    process.exit(1);
}

// 2. Test OpenAI API directly
async function testOpenAI() {
    console.log('\nTesting OpenAI API connection...');
    try {
        const res = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        console.log('Status Code:', res.status);

        if (res.ok) {
            console.log('✅ Success! The API key is valid.');
            const data = await res.json();
            // Check if gpt-4o-mini is available
            const has4oMini = data.data.some(m => m.id === 'gpt-4o-mini');
            console.log('gpt-4o-mini available:', has4oMini);
        } else {
            console.log('❌ Failed. The API key is invalid or has issues.');
            const error = await res.json();
            console.log('Error details:', JSON.stringify(error, null, 2));

            if (res.status === 401) {
                console.log('-> Reason: Invalid Authentication. Check if the key is correct.');
            } else if (res.status === 429) {
                console.log('-> Reason: Rate limit exceeded or quota exceeded (check billing).');
            }
        }
    } catch (error) {
        console.error('Network Error:', error.message);
    }
}

testOpenAI();
