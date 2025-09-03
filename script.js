// 全局变量
let stampImage = null;
let stampSlices = [];
let pdfDocument = null;
let resultPdfBytes = null;

// DOM元素
const stampFileInput = document.getElementById('stampFile');
const stampPreviewContainer = document.getElementById('stampPreviewContainer');
const stampImageElement = document.getElementById('stampImage');
const pageCountInput = document.getElementById('pageCount');
const sliceStampBtn = document.getElementById('sliceStampBtn');
const slicesPreviewContainer = document.getElementById('slicesPreviewContainer');
const stampSlicesContainer = document.getElementById('stampSlices');
const pdfFileInput = document.getElementById('pdfFile');
const pdfPreviewContainer = document.getElementById('pdfPreviewContainer');
const pdfFrame = document.getElementById('pdfFrame');
const generateBtn = document.getElementById('generateBtn');
const statusMessage = document.getElementById('statusMessage');
const resultPreviewContainer = document.getElementById('resultPreviewContainer');
const resultFrame = document.getElementById('resultFrame');
const downloadContainer = document.getElementById('downloadContainer');
const downloadBtn = document.getElementById('downloadBtn');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 印章上传和预览
    stampFileInput.addEventListener('change', handleStampUpload);
    
    // 切割印章
    sliceStampBtn.addEventListener('click', sliceStamp);
    
    // PDF上传和预览
    pdfFileInput.addEventListener('change', handlePdfUpload);
    
    // 生成骑缝章PDF
    generateBtn.addEventListener('click', generateStampedPdf);
    
    // 下载PDF
downloadBtn.addEventListener('click', downloadPdf);

// 检查是否在Electron环境中运行
const isElectron = () => {
    return window && window.process && window.process.type;
};
    
    // 页数输入框变化时重新切割印章
    pageCountInput.addEventListener('change', () => {
        if (stampImage) {
            sliceStamp();
        }
    });
    
    // 显示初始提示
    showStatus('请上传PNG格式的印章图片和PDF文件', 'loading');
    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 3000);
});

// 处理印章上传
async function handleStampUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 检查文件类型
    if (file.type !== 'image/png') {
        showStatus('请上传PNG格式的印章图片', 'error');
        return;
    }
    
    try {
        // 读取文件并创建图像对象
        const imageUrl = URL.createObjectURL(file);
        stampImage = new Image();
        
        stampImage.onload = function() {
            // 显示预览
            stampImageElement.src = imageUrl;
            stampPreviewContainer.classList.remove('hidden');
            
            // 清除之前的切片
            stampSlices = [];
            stampSlicesContainer.innerHTML = '';
            slicesPreviewContainer.classList.add('hidden');
            
            // 重置生成按钮
            generateBtn.disabled = true;
            resultPreviewContainer.classList.add('hidden');
            downloadContainer.classList.add('hidden');
            statusMessage.classList.add('hidden');
            
            // 如果已有PDF文件，自动切割印章
            if (pdfDocument) {
                sliceStamp();
            } else {
                showStatus('印章已上传，请上传PDF文件以自动切割印章', 'success');
            }
        };
        
        stampImage.src = imageUrl;
    } catch (error) {
        console.error('印章加载失败:', error);
        showStatus('印章加载失败', 'error');
    }
}

// 显示状态消息
function showStatus(message, type) {
    // 添加加载动画（如果是loading类型）
    if (type === 'loading') {
        statusMessage.innerHTML = `<span class="loading-spinner"></span>${message}`;
    } else {
        statusMessage.textContent = message;
    }
    
    statusMessage.className = `status ${type}`;
    statusMessage.classList.remove('hidden');
    
    // 清除之前的定时器
    if (window.statusTimeout) {
        clearTimeout(window.statusTimeout);
    }
    
    // 如果是错误或成功消息，5秒后自动隐藏
    if (type === 'error' || type === 'success') {
        window.statusTimeout = setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 5000);
    }
}

// 切割印章
function sliceStamp() {
    if (!stampImage) {
        showStatus('请先上传印章图片', 'error');
        return;
    }
    
    const pageCount = parseInt(pageCountInput.value);
    if (isNaN(pageCount) || pageCount < 2) {
        showStatus('页数必须大于等于2', 'error');
        return;
    }
    
    try {
        // 创建临时画布
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 设置画布尺寸为印章尺寸
        canvas.width = stampImage.width;
        canvas.height = stampImage.height;
        
        // 绘制印章
        ctx.drawImage(stampImage, 0, 0);
        
        // 获取印章图像数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // 计算每个切片的宽度
        const sliceWidth = Math.floor(canvas.width / pageCount);
        
        // 清空之前的切片
        stampSlices = [];
        stampSlicesContainer.innerHTML = '';
        
        // 创建切片
        for (let i = 0; i < pageCount; i++) {
            // 创建切片画布
            const sliceCanvas = document.createElement('canvas');
            const sliceCtx = sliceCanvas.getContext('2d');
            
            // 设置切片画布尺寸
            sliceCanvas.width = sliceWidth;
            sliceCanvas.height = canvas.height;
            
            // 计算切片的起始x坐标
            const startX = i * sliceWidth;
            
            // 绘制切片
            sliceCtx.drawImage(
                stampImage,
                startX, 0, sliceWidth, canvas.height,
                0, 0, sliceWidth, canvas.height
            );
            
            // 获取切片的数据URL
            const sliceDataUrl = sliceCanvas.toDataURL('image/png');
            
            // 保存切片
            stampSlices.push({
                index: i,
                dataUrl: sliceDataUrl,
                width: sliceWidth,
                height: canvas.height
            });
            
            // 创建切片预览元素
            const sliceElement = document.createElement('div');
            sliceElement.className = 'stamp-slice';
            sliceElement.innerHTML = `
                <img src="${sliceDataUrl}" alt="切片 ${i+1}">
                <div>第 ${i+1} 页</div>
            `;
            
            // 添加到预览容器
            stampSlicesContainer.appendChild(sliceElement);
        }
        
        // 显示切片预览
        slicesPreviewContainer.classList.remove('hidden');
        
        // 检查是否可以生成PDF
        checkGenerateButtonState();
        
        showStatus(`印章已成功切割为 ${pageCount} 份`, 'success');
    } catch (error) {
        console.error('印章切割失败:', error);
        showStatus('印章切割失败', 'error');
    }
}

// 检查生成按钮状态
function checkGenerateButtonState() {
    generateBtn.disabled = !(stampSlices.length > 0 && pdfDocument);
}

// 处理PDF上传
async function handlePdfUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 检查文件类型
    if (file.type !== 'application/pdf') {
        showStatus('请上传PDF格式的文件', 'error');
        return;
    }
    
    try {
        showStatus('正在加载PDF文件...', 'loading');
        
        // 读取文件
        const arrayBuffer = await file.arrayBuffer();
        const pdfBytes = new Uint8Array(arrayBuffer);
        
        // 使用PDF.js加载PDF预览
        const pdfUrl = URL.createObjectURL(file);
        pdfFrame.src = pdfUrl;
        pdfPreviewContainer.classList.remove('hidden');
        
        // 使用pdf-lib加载PDF文档
        const { PDFDocument } = PDFLib;
        pdfDocument = await PDFDocument.load(pdfBytes);
        
        // 获取PDF页数
        const pageCount = pdfDocument.getPageCount();
        
        // 更新页数输入框
        pageCountInput.value = pageCount;
        
        // 如果已有印章，重新切割
        if (stampImage) {
            sliceStamp();
        }
        
        // 检查是否可以生成PDF
        checkGenerateButtonState();
        
        showStatus(`PDF文件已加载，共 ${pageCount} 页`, 'success');
    } catch (error) {
        console.error('PDF加载失败:', error);
        showStatus('PDF加载失败', 'error');
    }
}

// 生成带有骑缝章的PDF
async function generateStampedPdf() {
    if (!stampImage) {
        showStatus('请先上传PNG格式的印章图片', 'error');
        return;
    }
    
    if (!pdfDocument) {
        showStatus('请先上传PDF文件', 'error');
        return;
    }
    
    if (stampSlices.length === 0) {
        showStatus('请先切割印章', 'error');
        return;
    }
    
    try {
        // 禁用按钮，防止重复点击
        generateBtn.disabled = true;
        showStatus('正在生成骑缝章PDF...', 'loading');
        
        // 克隆PDF文档以避免修改原始文档
        const { PDFDocument } = PDFLib;
        const newPdfDoc = await PDFDocument.create();
        
        // 获取页数
        const pageCount = pdfDocument.getPageCount();
        
        // 确保印章切片数量与页数一致
        if (stampSlices.length !== pageCount) {
            showStatus(`印章切片数量(${stampSlices.length})与PDF页数(${pageCount})不一致，请重新切割印章`, 'error');
            generateBtn.disabled = false;
            return;
        }
        
        // 复制所有页面并添加印章
        const pages = await newPdfDoc.copyPages(pdfDocument, [...Array(pageCount).keys()]);
        
        for (let i = 0; i < pageCount; i++) {
            const page = pages[i];
            newPdfDoc.addPage(page);
            
            // 获取页面尺寸
            const { width, height } = page.getSize();
            
            // 获取对应的印章切片
            const stampSlice = stampSlices[i];
            
            // 将切片转换为图像
            const stampImage = await createImageFromDataUrl(stampSlice.dataUrl, newPdfDoc);
            
            // 计算印章位置 - 右侧边缘，垂直位置在2/3处
            
            // A4纸张尺寸为210mm×297mm，PDF单位为点(pt)，1mm约等于2.83pt
            // 标准印章直径通常为40-45mm，我们取42mm作为标准
            // 计算印章切片的实际宽度（按照A4纸张比例）
            const A4_WIDTH_PT = 595.28; // A4宽度，约210mm
            const A4_HEIGHT_PT = 841.89; // A4高度，约297mm
            
            // 计算印章在A4纸上的合适尺寸
            // 标准印章直径约为42mm，约等于119pt
            const STAMP_STANDARD_DIAMETER_PT = 119;
            
            // 计算印章切片的缩放比例
            // 假设原始印章是圆形的，高度代表直径
            const originalStampDiameter = stampSlice.height;
            const scaleFactor = STAMP_STANDARD_DIAMETER_PT / originalStampDiameter;
            
            // 计算缩放后的印章切片尺寸
            const stampWidth = stampSlice.width * scaleFactor;
            const stampHeight = stampSlice.height * scaleFactor;
            
            // 计算印章位置 - 右侧边缘，垂直位置在2/3处
            const stampX = width - stampWidth;
            const stampY = height / 3; // 从底部算起，位于1/3处，即从顶部算是2/3处
            
            // 添加印章到页面
            page.drawImage(stampImage, {
                x: stampX,
                y: stampY,
                width: stampWidth,
                height: stampHeight,
            });
        }
        
        // 生成PDF
        resultPdfBytes = await newPdfDoc.save();
        
        // 创建预览URL
        const resultBlob = new Blob([resultPdfBytes], { type: 'application/pdf' });
        const resultUrl = URL.createObjectURL(resultBlob);
        
        // 显示预览
        resultFrame.src = resultUrl;
        resultPreviewContainer.classList.remove('hidden');
        downloadContainer.classList.remove('hidden');
        
        showStatus('骑缝章PDF生成成功', 'success');
    } catch (error) {
        console.error('生成骑缝章PDF失败:', error);
        showStatus(`生成骑缝章PDF失败: ${error.message || '未知错误'}`, 'error');
    } finally {
        // 恢复按钮状态
        generateBtn.disabled = false;
    }
}

// 从DataURL创建PDF图像
async function createImageFromDataUrl(dataUrl, pdfDoc) {
    // 从DataURL中提取Base64数据
    const base64Data = dataUrl.split(',')[1];
    
    // 将Base64转换为Uint8Array
    const imageBytes = base64ToUint8Array(base64Data);
    
    // 将图像嵌入到PDF文档中
    return await pdfDoc.embedPng(imageBytes);
}

// Base64转Uint8Array
function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// 下载PDF
async function downloadPdf() {
    if (!resultPdfBytes) {
        showStatus('请先生成骑缝章PDF', 'error');
        return;
    }
    
    // 禁用下载按钮，防止重复点击
    downloadBtn.disabled = true;
    showStatus('正在准备下载...', 'loading');
    
    try {
        if (isElectron()) {
            // 在Electron环境中使用原生对话框
            const { dialog } = window.require('@electron/remote');
            const fs = window.require('fs');
            
            const options = {
                title: '保存骑缝章PDF',
                defaultPath: '骑缝章文档.pdf',
                filters: [
                    { name: 'PDF文件', extensions: ['pdf'] }
                ]
            };
            
            const result = await dialog.showSaveDialog(options);
            
            if (!result.canceled && result.filePath) {
                // 将PDF数据写入文件
                fs.writeFileSync(result.filePath, Buffer.from(resultPdfBytes));
                showStatus('文件已保存: ' + result.filePath, 'success');
            } else {
                showStatus('保存已取消', 'loading');
            }
        } else {
            // 在浏览器环境中使用传统下载方式
            // 创建Blob对象
            const blob = new Blob([resultPdfBytes], { type: 'application/pdf' });
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '骑缝章文档.pdf';
            
            // 触发下载
            document.body.appendChild(a);
            a.click();
            
            // 清理
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showStatus('下载完成', 'success');
            }, 1000);
        }
    } catch (error) {
        console.error('保存文件失败:', error);
        showStatus(`保存文件失败: ${error.message || '未知错误'}`, 'error');
    } finally {
        // 恢复下载按钮状态
        downloadBtn.disabled = false;
    }
}