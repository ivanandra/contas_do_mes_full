from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import User, Payment
from app.schemas.schemas import PaymentOut

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("", response_model=List[PaymentOut])
def list_payments(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Payment).filter(Payment.user_id == current_user.id)
    if month:
        query = query.filter(Payment.payment_month == month)
    if year:
        query = query.filter(Payment.payment_year == year)
    return query.order_by(Payment.created_at.desc()).all()


@router.delete("/{payment_id}", status_code=204)
def delete_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = db.query(Payment).filter(
        Payment.id == payment_id, Payment.user_id == current_user.id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    db.delete(payment)
    db.commit()


@router.post("/{payment_id}/receipt", response_model=PaymentOut)
async def upload_receipt(
    payment_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = db.query(Payment).filter(
        Payment.id == payment_id, Payment.user_id == current_user.id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")

    try:
        import cloudinary
        import cloudinary.uploader
        from app.config import settings
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
        )
        contents = await file.read()
        result = cloudinary.uploader.upload(contents, folder="contas_do_mes/receipts")
        payment.receipt_image_url = result.get("secure_url")
        payment.receipt_public_id = result.get("public_id")
        db.commit()
        db.refresh(payment)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no upload: {str(e)}")

    return payment
