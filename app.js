// ===============================
// Local Ollama Chat
// Part-1
// ===============================

const chat = document.getElementById("chat");
const prompt = document.getElementById("prompt");

const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");

const themeBtn = document.getElementById("themeBtn");

let dark = true;

let uploadedFile = null;

const messages = [];


// =========================================
// Theme
// =========================================

themeBtn.onclick = () => {

    dark = !dark;

    document.body.classList.toggle("light");

    if (dark) {
        themeBtn.innerHTML = "☀️ Light";
    } else {
        themeBtn.innerHTML = "🌙 Dark";
    }

};


// =========================================
// Upload
// =========================================

uploadBtn.onclick = () => {

    fileInput.click();

};


fileInput.onchange = () => {

    if(fileInput.files.length===0)
        return;

    uploadedFile=fileInput.files[0];

    fileName.innerHTML=uploadedFile.name;

};


// =========================================
// Clear Chat
// =========================================

clearBtn.onclick=()=>{

    messages.length=0;

    chat.innerHTML="";

    prompt.value="";

    uploadedFile=null;

    fileInput.value="";

    fileName.innerHTML="No file selected";

};


// =========================================
// Chat Rendering
// =========================================

function addUserMessage(text){

    const wrapper = document.createElement("div");
    wrapper.className = "message user";

    const bubble = document.createElement("div");
    bubble.className = "user-bubble";

    bubble.innerText = text;

    wrapper.appendChild(bubble);

    chat.appendChild(wrapper);

    scrollBottom();
}


function addAIMessage(markdown){

    const wrapper = document.createElement("div");
    wrapper.className = "message ai";

    const bubble = document.createElement("div");
    bubble.className = "ai-bubble";

    bubble.innerHTML = marked.parse(markdown);

    wrapper.appendChild(bubble);

    chat.appendChild(wrapper);

    document.querySelectorAll("pre code").forEach(el => {
        hljs.highlightElement(el);
    });

    scrollBottom();
}



function scrollBottom(){

    chat.scrollTop=chat.scrollHeight;

}



// =========================================
// Loading
// =========================================

function showLoading(){

    const div=document.createElement("div");

    div.className="message ai";

    div.id="loading";

    div.innerHTML="🤖 Thinking...";

    chat.appendChild(div);

    scrollBottom();

}



function hideLoading(){

    const loading=document.getElementById("loading");

    if(loading)
        loading.remove();

}

function lockUI(){

    prompt.readOnly = true;

    sendBtn.disabled = true;

    uploadBtn.disabled = true;

    clearBtn.disabled = true;

    themeBtn.disabled = true;

}

function unlockUI(){

    prompt.readOnly = false;

    sendBtn.disabled = false;

    uploadBtn.disabled = false;

    clearBtn.disabled = false;

    themeBtn.disabled = false;

    prompt.focus();

}



// =========================================
// File Type
// =========================================

function isImage(file){

    return file.type.startsWith("image/");

}



function isPdf(file){

    return file.type==="application/pdf";

}



// =========================================
// Model Selection
// =========================================

function chooseModel(file){

    if(file==null)
        return "qwen3:8b";

    if(isImage(file))
        return "gemma3:latest";

    return "qwen3:8b";

}



// =========================================
// Read Text File
// =========================================

async function readTextFile(file){

    return await file.text();

}



// =========================================
// Image -> Base64
// =========================================

function imageToBase64(file){

    return new Promise((resolve,reject)=>{

        const reader=new FileReader();

        reader.onload=()=>{

            const base64=reader.result
                .split(",")[1];

            resolve(base64);

        };

        reader.onerror=reject;

        reader.readAsDataURL(file);

    });

}



// =========================================
// PDF Extraction
// =========================================

// PDF.js library required

async function extractPdf(file) {

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer
    }).promise;

    let text = "";

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {

        const page = await pdf.getPage(pageNo);

        const content = await page.getTextContent();

        const pageText = content.items
            .map(item => item.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

        text += `\n\n----- Page ${pageNo} -----\n\n`;
        text += pageText;
    }

    return text;
}

// =========================================
// Send
// =========================================

async function send() {

   const question = prompt.value.trim();

    if (question === "" && uploadedFile == null)
        return;

    // Save attachment before clearing UI
    const currentFile = uploadedFile;

    // Show user message immediately
    addUserMessage(question);

    // Clear UI immediately
    prompt.value = "";

    uploadedFile = null;

    fileInput.value = "";

    fileName.innerHTML = "No file selected";

    showLoading();

    lockUI();



    try {

        const model = chooseModel(currentFile);

        let requestMessages = [...messages];

        // ----------------------------------
        // Image Upload
        // ----------------------------------

        if (currentFile && isImage(currentFile)) {

            const base64 = await imageToBase64(currentFile);

            requestMessages.push({

                role: "user",

                content: question,

                images: [base64]

            });

        }

        // ----------------------------------
        // PDF Upload
        // ----------------------------------

        else if (currentFile && isPdf(currentFile)) {

            const pdfText = await extractPdf(currentFile);

            requestMessages.push({

                role: "user",

                content:
                    question +
                    "\n\n---------------- PDF ----------------\n\n" +
                    pdfText

            });

        }

        // ----------------------------------
        // Text / Java / JSON / YAML etc.
        // ----------------------------------

        else if (currentFile) {

            const text = await readTextFile(currentFile);

            requestMessages.push({

                role: "user",

                content:
                    question +
                    "\n\n---------------- FILE ----------------\n\n" +
                    text

            });

        }

        // ----------------------------------
        // Prompt Only
        // ----------------------------------

        else {

            requestMessages.push({

                role: "user",

                content: question

            });

        }

        const request = {

            model: model,

            stream: false,

            messages: requestMessages

        };

        console.log(request);

        const response = await fetch(

            "http://localhost:11434/api/chat",

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify(request)

            }

        );

       if (!response.ok) {

        const error = await response.text();

        throw new Error(error);

}

        const json = await response.json();

        hideLoading();
        

        unlockUI();

       const inputTokens = json.prompt_eval_count || 0;
        const outputTokens = json.eval_count || 0;
        const totalTokens = inputTokens + outputTokens;

        // Ollama durations are in nanoseconds
        const totalSeconds = json.total_duration / 1_000_000_000;

        let responseTime;

        if (totalSeconds < 60) {
            responseTime = `${totalSeconds.toFixed(2)} sec`;
        } else {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = Math.round(totalSeconds % 60);
            responseTime = `${minutes} min ${seconds} sec`;
        }

        const responseWithStats =
            json.message.content +
            "\n\n---\n" +
            "**📊 Response Statistics**\n\n" +
            `- ⏱️ Response Time : **${responseTime}**\n` +
            `- 📥 Input Tokens : **${inputTokens}**\n` +
            `- 📤 Output Tokens : **${outputTokens}**\n` +
            `- 🔢 Total Tokens : **${totalTokens}**`;

        addAIMessage(responseWithStats);
        console.log(json.message.content);

       // ==========================
        // Save Conversation History
        // (Do NOT save uploaded images)
        // ==========================

        messages.push({

            role: "user",

            content: question

        });

        messages.push({

            role: "assistant",

            content: json.message.content

        });

    }
    catch (e) {

     

    hideLoading();

    unlockUI();

    addAIMessage(

        "❌ Error\n\n" +

        e.message

    );

    console.error(e);


    }



}



// =========================================
// Send Button
// =========================================

sendBtn.onclick = send;



// =========================================
// Enter to Send
// =========================================

prompt.addEventListener(

    "keydown",

    function (e) {

        if (

            e.key === "Enter"

            &&

            !e.shiftKey

        ) {

            e.preventDefault();

            send();

        }

    }

);