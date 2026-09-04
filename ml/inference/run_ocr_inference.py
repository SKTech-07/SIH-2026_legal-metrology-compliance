
import os
import argparse
from paddleocr import PaddleOCR

def main():
    parser = argparse.ArgumentParser(description='Run OCR inference using PaddleOCR.')
    parser.add_argument('--image_path', type=str, required=True, help='Path to the input image file.')
    args = parser.parse_args()

    # Initialize PaddleOCR
    # PaddleOCR auto-detects GPU if available, so use_gpu=True is not needed and might cause errors in newer versions.
    # use_angle_cls is deprecated, use use_textline_orientation instead.
    ocr = PaddleOCR(use_textline_orientation=True, lang='en')

    img_path = args.image_path
    if not os.path.exists(img_path):
        print(f"Error: Image file not found at {img_path}")
        return

    print(f"Running OCR on: {img_path}")
    # predict() replaces the deprecated ocr.ocr() call and returns a list of
    # result objects, each behaving like a dict with rec_texts/rec_scores/rec_polys.
    results = ocr.predict(img_path)

    if not results:
        print("No text detected.")
        return

    found_any = False
    for res in results:
        texts = res.get('rec_texts', [])
        scores = res.get('rec_scores', [])
        # rec_polys holds the quadrilateral boxes; some versions expose rec_boxes (axis-aligned) instead.
        polys = res.get('rec_polys', res.get('rec_boxes', []))

        if not texts:
            continue

        found_any = True
        for i, text in enumerate(texts):
            score = float(scores[i]) if i < len(scores) else 0.0
            bbox = polys[i] if i < len(polys) else None
            print(f"Text: '{text}', Score: {score:.4f}, BBox: {bbox}")

    if not found_any:
        print("No text detected.")

if __name__ == '__main__':
    main()
