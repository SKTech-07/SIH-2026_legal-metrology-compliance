import os

os.environ["FLAGS_use_mkldnn"] = "0"

import argparse
from paddleocr import PaddleOCR

def main():
    parser = argparse.ArgumentParser(description='Run OCR inference using PaddleOCR.')
    parser.add_argument('--image_path', type=str, required=True, help='Path to the input image file.')
    args = parser.parse_args()

    ocr = PaddleOCR(
        use_textline_orientation=True,
        lang='en',
        enable_mkldnn=False
    )

    img_path = args.image_path

    if not os.path.exists(img_path):
        print(f"Error: Image file not found at {img_path}")
        return

    print(f"Running OCR on: {img_path}")

    results = ocr.predict(img_path)

    if not results:
        print("No text detected.")
        return

    found_any = False

    for res in results:
        texts = res.get('rec_texts', [])
        scores = res.get('rec_scores', [])
        polys = res.get('rec_polys', res.get('rec_boxes', []))

        if not texts:
            continue

        found_any = True

        for i, text in enumerate(texts):
            score = float(scores[i]) if i < len(scores) else 0.0
            bbox = polys[i] if i < len(polys) else None

            print(
                f"Text: '{text}', "
                f"Score: {score:.4f}, "
                f"BBox: {bbox}"
            )

    if not found_any:
        print("No text detected.")


if __name__ == '__main__':
    main()