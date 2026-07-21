from PIL import Image
import os

def create_icons():
    # Open the original logo
    logo_path = '/home/admin/.openclaw/workspace/bvsradio_html/assets/images/Bvsradio_logo.png'
    img = Image.open(logo_path)
    
    # Convert to RGBA if not already
    #if img.mode != 'RGBA':
    #   img = img.convert('RGBA')
    
    # Create 192x192 icon
    icon_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save('/home/admin/.openclaw/workspace/bvsradio_html/assets/images/icon-192.png', 'PNG')
    print("Created icon-192.png")
    
    # Create 512x512 icon
    icon_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save('/home/admin/.openclaw/workspace/bvsradio_html/assets/images/icon-512.png', 'PNG')
    print("Created icon-512.png")

if __name__ == "__main__":
    create_icons()
