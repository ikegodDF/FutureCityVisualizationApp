let modalRoot;
let modalBackdrop;
let modalDialog;
let modalContent;
let onCloseHandler = null;

export function initModal() {
  if (document.getElementById('appModalRoot')) return;

  modalRoot = document.createElement('div');
  modalRoot.id = 'appModalRoot';

  modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'modal-backdrop';
  modalBackdrop.addEventListener('click', closeModal);

  modalDialog = document.createElement('div');
  modalDialog.className = 'modal-dialog';

  const header = document.createElement('div');
  header.className = 'modal-header';
  const title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = '特定状況の呼び出し';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', closeModal);
  header.appendChild(title);
  header.appendChild(closeBtn);

  modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  modalDialog.appendChild(header);
  modalDialog.appendChild(modalContent);

  modalRoot.appendChild(modalBackdrop);
  modalRoot.appendChild(modalDialog);
  document.body.appendChild(modalRoot);
}

export function openModal(contentNode) {
  initModal();
  setModalContent(contentNode);
  modalRoot.classList.add('show');
}

export function closeModal() {
  if (!modalRoot) return;
  modalRoot.classList.remove('show');
  if (onCloseHandler) {
    const handler = onCloseHandler;
    onCloseHandler = null;
    handler();
  }
}

export function setModalContent(node) {
  if (!modalContent) return;
  modalContent.innerHTML = '';
  if (node) modalContent.appendChild(node);
}

export function setModalCloseHandler(handler) {
  onCloseHandler = typeof handler === 'function' ? handler : null;
}
